// What every endpoint that calls the model shares (the chat of each surface,
// surface-chat-handler.ts, and the correction, correction-handler.ts): the
// entrance of a request, which answers 503 without a model and 400 to an
// invalid body, read no further than its limit, and logs the request
// otherwise; and the accounting of each call to the model (a step of the
// chat, an attempt of the correction): its tokens, its latency, the AI SDK's
// own retries and the fallback model that answered, with the request's
// totals.

import type { LanguageModel, LanguageModelUsage } from "ai";
import { modelIdOf } from "@/lib/atomy/model";
import {
  readRequestBody,
  type ParsedRequest,
  type RequestRejection,
} from "@/lib/atomy/request-body";
import {
  NO_TOKENS,
  addTokenCounts,
  requestLog,
  sdkRetriesOf,
  tokenCounts,
  type AtomyEndpoint,
  type AtomyLogEvent,
  type AtomyLogSink,
  type TokenCounts,
} from "@/lib/atomy/request-log";

export type RequestLogger = (event: AtomyLogEvent) => void;

/**
 * What a route handler that calls the model passes to its handler: the
 * model, the log's sink and, for tests, how long the model is waited for.
 */
export interface ModelHandlerOptions<Timeout> {
  /** The model, or null without a key: the reduced mode. */
  readonly model: LanguageModel | null;
  readonly log?: AtomyLogSink;
  readonly timeout?: Timeout;
}

/** A request the endpoint takes to the model, already logged. */
export interface AcceptedRequest<Body, Input> {
  readonly accepted: true;
  readonly log: RequestLogger;
  readonly body: Body;
  /** What the model reads besides the instructions, as the log keeps it. */
  readonly input: Input;
  readonly model: LanguageModel;
  readonly modelId: string;
}

/** A request answered before the model: the response to send, already logged. */
export interface RejectedRequest {
  readonly accepted: false;
  readonly response: Response;
}

export interface EndpointOptions<Body, Input> {
  readonly endpoint: AtomyEndpoint;
  /** The model, or null without a key. */
  readonly model: LanguageModel | null;
  readonly parse: (body: string) => ParsedRequest<Body>;
  /** The most characters of a body, which `parse` checks too. */
  readonly maxBodyChars: number;
  readonly sink: AtomyLogSink | undefined;
  readonly promptVersion: string;
  /** What the model reads of the request besides the instructions. */
  readonly input: (body: Body) => Input;
}

/**
 * The entrance of a request: without a model, 503 `reduced-mode`; with a
 * body that is not a valid request, 400 `invalid-request` with the reason in
 * the log; otherwise the request's event in the log and the request itself.
 */
export async function acceptRequest<Body, Input>(
  request: Request,
  {
    endpoint,
    model,
    parse,
    maxBodyChars,
    sink,
    promptVersion,
    input,
  }: EndpointOptions<Body, Input>,
): Promise<AcceptedRequest<Body, Input> | RejectedRequest> {
  const log = requestLog(endpoint, sink);
  if (!model) {
    log({
      event: "response",
      outcome: "rejected",
      status: 503,
      error: "reduced-mode",
    });
    return {
      accepted: false,
      response: Response.json({ error: "reduced-mode" }, { status: 503 }),
    };
  }
  const invalid = (rejection: RequestRejection): RejectedRequest => {
    log({
      event: "response",
      outcome: "rejected",
      status: 400,
      error: "invalid-request",
      rejection,
    });
    return {
      accepted: false,
      response: Response.json({ error: "invalid-request" }, { status: 400 }),
    };
  };
  const read = await readRequestBody(request, maxBodyChars);
  if (!read.success) return invalid(read.rejection);
  const parsed = parse(read.text);
  if (!parsed.success) return invalid(parsed.rejection);
  const modelInput = input(parsed.data);
  const modelId = modelIdOf(model);
  log({ event: "request", model: modelId, promptVersion, input: modelInput });
  return {
    accepted: true,
    log,
    body: parsed.data,
    input: modelInput,
    model,
    modelId,
  };
}

/** What one failed call to the model did, as its event in the log keeps it. */
export interface FailedCallRecord {
  readonly totalMs: number;
  /** The AI SDK's own retries of the call. */
  readonly sdkRetries: number;
}

/** What one call to the model that answered did: its usage besides. */
export interface CallRecord extends FailedCallRecord, TokenCounts {
  /** The model that answered, when the main one had run out of quota. */
  readonly fallbackModel?: string;
}

export interface CallMetrics {
  /** A call to the model starts: a step of the chat, an attempt of the correction. */
  readonly start: () => void;
  /** The AI SDK calls the provider, once per call and once more per retry. */
  readonly onCallStart: () => void;
  /** The call ended with the model's output, written by `modelId`. */
  readonly success: (
    usage: LanguageModelUsage | undefined,
    modelId?: string,
  ) => CallRecord;
  /** The call failed at the provider. */
  readonly failure: (error: unknown) => FailedCallRecord;
  /** The request's tokens so far, over every call. */
  readonly tokens: () => TokenCounts;
  /** The request's retries of the AI SDK so far, over every call. */
  readonly sdkRetries: () => number;
}

/** The accounting of a request's calls to the model `mainModelId`. */
export function callMetrics(mainModelId: string): CallMetrics {
  let tokens = NO_TOKENS;
  let sdkRetries = 0;
  let calls = 0;
  let startedAt = performance.now();
  // Each call to the model makes one call to the provider and one more per
  // retry, which the AI SDK runs inside it: the retries are the calls beyond
  // the first.
  const retriesSoFar = () => Math.max(0, calls - 1);
  return {
    start: () => {
      calls = 0;
      startedAt = performance.now();
    },
    onCallStart: () => {
      calls += 1;
    },
    success: (usage, modelId) => {
      const counts = tokenCounts(usage);
      const retries = retriesSoFar();
      tokens = addTokenCounts(tokens, counts);
      sdkRetries += retries;
      return {
        ...counts,
        totalMs: performance.now() - startedAt,
        sdkRetries: retries,
        ...(modelId === undefined || modelId === mainModelId
          ? {}
          : { fallbackModel: modelId }),
      };
    },
    failure: (error) => {
      const retries = sdkRetriesOf(error) ?? retriesSoFar();
      sdkRetries += retries;
      return { totalMs: performance.now() - startedAt, sdkRetries: retries };
    },
    tokens: () => tokens,
    sdkRetries: () => sdkRetries,
  };
}
