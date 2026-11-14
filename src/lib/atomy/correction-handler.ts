// The correction of the reader's reasoning in a prediction, server side: one
// call to the model, without tools, whose structured output the code
// consumes. The output is checked against the lesson's
// rules besides its schema and, when it breaks them, the model gets one
// more attempt with the concrete error. The route handler passes the
// model, or null without a key; tests pass a MockLanguageModelV4. Every
// request writes its log: the input, each attempt and the response.

import {
  NoObjectGeneratedError,
  Output,
  TypeValidationError,
  generateText,
  jsonSchema,
  zodSchema,
  type FinishReason,
  type JSONSchema7,
  type ModelMessage,
} from "ai";
import { z } from "zod";
import {
  CORRECTION_INSTRUCTIONS,
  CORRECTION_PROMPT_VERSION,
  correctionInput,
  correctionRetry,
} from "@/lib/atomy/correction-prompt";
import {
  CORRECTION_MAX_FEEDBACK_CHARS,
  MAX_CORRECTION_BODY_CHARS,
  correctionAnswerSchema,
  parseCorrectionRequest,
  type Correction,
  type CorrectionErrorCode,
  type CorrectionRequest,
  type CorrectionResponse,
} from "@/lib/atomy/correction-request";
import { VERDICTS, type Verdict } from "@/lib/lesson/verdicts";
import { misconceptionsOf } from "@/lib/lesson/misconceptions";
import {
  acceptRequest,
  callMetrics,
  type ModelHandlerOptions,
} from "@/lib/atomy/model-endpoint";
import { modelErrorCode } from "@/lib/atomy/model-errors";
import { providerErrorLog, type AbortedBy } from "@/lib/atomy/request-log";

/**
 * Gemini's thinking and the JSON object with its three sentences. The
 * thinking counts against this limit: with 500, about 480 tokens of thinking
 * left the JSON cut short (finishReason "length").
 */
export const CORRECTION_MAX_OUTPUT_TOKENS = 4096;

/** The attempts at an output that keeps the rules: the first and one retry. */
export const CORRECTION_MAX_ATTEMPTS = 2;

/**
 * How long each attempt waits for Gemini. Not measured yet
 * against the real model: generous for a flash model's short JSON answer.
 */
export const CORRECTION_TIMEOUT_MS = 20_000;

export interface CorrectionTimeout {
  /** How long each attempt waits for the model. */
  readonly totalMs: number;
}

/** What the route handler of the correction passes to the correction. */
export type CorrectionHandlerOptions = ModelHandlerOptions<CorrectionTimeout>;

/**
 * The correction before the rules are checked: correctionAnswerSchema with
 * the fields that have a rule of their own in checkCorrection as plain text,
 * trimmed, and the enum values compared without case. Any other field keeps
 * its schema, so a new field is added in correctionAnswerSchema alone.
 */
const rawCorrection = correctionAnswerSchema.extend({
  verdict: z.string().trim().toLowerCase(),
  misconception: z.string().trim().toLowerCase().nullable(),
  feedback: z.string().trim(),
});

const CORRECTION_FIELDS = Object.keys(correctionAnswerSchema.shape).join(", ");

function isVerdict(value: string): value is Verdict {
  return VERDICTS.some((verdict) => verdict === value);
}

/**
 * The model's output as a correction, or the concrete rule it breaks.
 * The enum values are compared without case.
 */
export function checkCorrection(
  value: unknown,
  request: CorrectionRequest,
): { success: true; value: Correction } | { success: false; error: string } {
  const parsed = rawCorrection.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      error: `La salida tiene que ser un objeto con ${CORRECTION_FIELDS}.\n${z.prettifyError(parsed.error)}`,
    };
  }
  const { verdict, feedback } = parsed.data;
  if (!isVerdict(verdict)) {
    return {
      success: false,
      error: `verdict «${parsed.data.verdict}» no es uno de ${VERDICTS.join(", ")}.`,
    };
  }
  const allowed = misconceptionsOf(request.prediction.id);
  const asked = parsed.data.misconception;
  const misconception = allowed.find((id) => id === asked) ?? null;
  if (asked !== null && misconception === null) {
    return {
      success: false,
      error: `misconception «${String(parsed.data.misconception)}» no está en el catálogo de la predicción ${request.prediction.id}: ${allowed.join(", ")}.`,
    };
  }
  if (verdict === "correct" && misconception !== null) {
    return {
      success: false,
      error: 'Con verdict "correct", misconception es null.',
    };
  }
  if (verdict === "incorrect" && misconception === null) {
    return {
      success: false,
      error: `Con verdict "incorrect", misconception es una de: ${allowed.join(", ")}.`,
    };
  }
  const { chosen, answer } = request.prediction;
  if (verdict === "correct" && chosen !== answer) {
    return {
      success: false,
      error:
        'La respuesta del lector no es la correcta: verdict no puede ser "correct".',
    };
  }
  if (feedback.length === 0) {
    return { success: false, error: "feedback no puede estar vacío." };
  }
  if (feedback.length > CORRECTION_MAX_FEEDBACK_CHARS) {
    return {
      success: false,
      error: `feedback tiene ${String(feedback.length)} caracteres; el máximo es ${String(CORRECTION_MAX_FEEDBACK_CHARS)}.`,
    };
  }
  return { success: true, value: { ...parsed.data, verdict, misconception } };
}

/** The model receives the schema without its $schema dialect. */
function withoutDialect(schema: JSONSchema7): JSONSchema7 {
  const copy = { ...schema };
  delete copy.$schema;
  return copy;
}

/**
 * The output's schema for this request: the JSON Schema the model receives,
 * with the enum of the prediction's misconceptions intact, and checkCorrection
 * as its validation.
 */
function correctionSchema(request: CorrectionRequest) {
  const output = correctionAnswerSchema.extend({
    misconception: z.enum(misconceptionsOf(request.prediction.id)).nullable(),
  });
  const schema = async () => withoutDialect(await zodSchema(output).jsonSchema);
  return jsonSchema<Correction>(schema, {
    validate: (value) => {
      const checked = checkCorrection(value, request);
      return checked.success
        ? checked
        : { success: false, error: new Error(checked.error) };
    },
  });
}

/** The concrete error of an output that did not pass, for the retry. */
function outputError(error: NoObjectGeneratedError): string {
  const cause = error.cause;
  if (TypeValidationError.isInstance(cause) && cause.cause instanceof Error) {
    return cause.cause.message;
  }
  return error.finishReason === "length"
    ? "La salida se cortó por su longitud: acorta feedback."
    : "La salida no es un JSON válido con verdict, misconception y feedback.";
}

/**
 * Whose abort ended an attempt that failed with `error`, or undefined when it
 * failed otherwise. Only the reader's own stop aborts the request: any other
 * abort is the attempt's timeout.
 */
function abortedByOf(request: Request, error: unknown): AbortedBy | undefined {
  if (request.signal.aborted) return "reader";
  const aborted =
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError");
  return aborted ? "timeout" : undefined;
}

export function createCorrectionHandler({
  model,
  log: sink,
  timeout = { totalMs: CORRECTION_TIMEOUT_MS },
}: CorrectionHandlerOptions): (request: Request) => Promise<Response> {
  return async (request) => {
    const accepted = await acceptRequest(request, {
      endpoint: "correction",
      model,
      parse: parseCorrectionRequest,
      maxBodyChars: MAX_CORRECTION_BODY_CHARS,
      sink,
      promptVersion: CORRECTION_PROMPT_VERSION,
      input: correctionInput,
    });
    if (!accepted.accepted) return accepted.response;
    const { log, body, input } = accepted;
    const startedAt = performance.now();
    const metrics = callMetrics(accepted.modelId);
    let finishReason: FinishReason | undefined;
    const respond = (
      attempts: number,
      answer: CorrectionResponse | CorrectionErrorCode,
      abortedBy?: AbortedBy,
    ): Response => {
      const ending =
        typeof answer !== "string"
          ? { status: 200 as const }
          : answer === "rate-limit"
            ? { status: 429 as const, error: answer }
            : { status: 502 as const, error: answer };
      log({
        event: "response",
        outcome: "answered",
        ...ending,
        attempts,
        sdkRetries: metrics.sdkRetries(),
        ...metrics.tokens(),
        finishReason,
        ...(abortedBy ? { abortedBy } : {}),
        totalMs: performance.now() - startedAt,
      });
      return typeof answer === "string"
        ? Response.json({ error: answer }, { status: ending.status })
        : Response.json(answer);
    };
    const messages: ModelMessage[] = [{ role: "user", content: input }];
    for (let attempt = 1; ; attempt += 1) {
      metrics.start();
      try {
        const result = await generateText({
          model: accepted.model,
          telemetry: { functionId: "atomy-correction" },
          instructions: CORRECTION_INSTRUCTIONS,
          messages,
          output: Output.object({ schema: correctionSchema(body) }),
          maxOutputTokens: CORRECTION_MAX_OUTPUT_TOKENS,
          abortSignal: request.signal,
          timeout,
          onLanguageModelCallStart: metrics.onCallStart,
        });
        finishReason = result.finishReason;
        const call = metrics.success(
          result.usage,
          result.finalStep.response.modelId,
        );
        log({
          event: "attempt",
          attempt,
          outcome: "success",
          finishReason,
          ...call,
          text: result.text,
        });
        return respond(
          attempt,
          call.fallbackModel === undefined
            ? result.output
            : { ...result.output, fallback: true },
        );
      } catch (error) {
        const abortedBy = abortedByOf(request, error);
        if (abortedBy) {
          // The reader who stopped no longer reads the answer; a timeout is
          // a failure of the provider for them, which they can retry.
          log({
            event: "attempt",
            attempt,
            outcome: "aborted",
            ...metrics.failure(error),
            abortedBy,
          });
          return respond(attempt, "provider", abortedBy);
        }
        if (!NoObjectGeneratedError.isInstance(error)) {
          log({
            event: "attempt",
            attempt,
            outcome: "provider-error",
            ...metrics.failure(error),
            providerError: providerErrorLog(error),
          });
          return respond(attempt, modelErrorCode(error));
        }
        finishReason = error.finishReason;
        const validationError = outputError(error);
        log({
          event: "attempt",
          attempt,
          outcome: "invalid-output",
          finishReason,
          ...metrics.success(error.usage),
          text: error.text,
          validationError,
        });
        if (attempt >= CORRECTION_MAX_ATTEMPTS) {
          return respond(attempt, "invalid-output");
        }
        messages.push(
          ...(error.text
            ? [{ role: "assistant" as const, content: error.text }]
            : []),
          { role: "user", content: correctionRetry(validationError) },
        );
      }
    }
  };
}
