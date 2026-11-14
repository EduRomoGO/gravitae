// The log of each request to an endpoint that calls the model: one JSON line
// per event (the request with its input, each call to the model with its raw
// output, and the response), all with the request's id, so a failure or an
// answer of poor quality can be rebuilt from the log. The route handlers
// write the lines in development only; tests pass their own sink. Filter them
// with `npm run atomy-logs`.

import {
  APICallError,
  RetryError,
  type FinishReason,
  type LanguageModelUsage,
} from "ai";
import type { ModelErrorCode } from "@/lib/atomy/model-error-codes";
import type { RequestRejection } from "@/lib/atomy/request-body";

export type AtomyEndpoint = "chat" | "finder-chat" | "correction";

export interface TokenCounts {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  /** Gemini's thinking, which counts against maxOutputTokens. */
  reasoningTokens: number | undefined;
}

/** A failure of the model's provider, with its own words. */
export interface ProviderErrorLog {
  name: string;
  message: string;
  statusCode?: number;
  /** Each failed call, when the AI SDK retried and every retry failed. */
  errors?: ProviderErrorLog[];
}

/** A call to the model that ended with its output: usage, latency and raw output. */
interface AnsweredCallLog extends TokenCounts {
  totalMs: number;
  /** The AI SDK's own retries of the call. */
  sdkRetries: number;
  text: string | undefined;
  /** The model that answered, when the main one had run out of quota. */
  fallbackModel?: string;
}

/** A call to the model that failed at the provider: no usage, no output. */
interface FailedCallLog {
  outcome: "provider-error";
  totalMs: number;
  sdkRetries: number;
  providerError: ProviderErrorLog;
}

/** Whose abort ended a call to the model: the reader's stop or a timeout. */
export type AbortedBy = "reader" | "timeout";

/** A call to the model that an abort ended: no usage, no output. */
interface AbortedCallLog {
  outcome: "aborted";
  totalMs: number;
  sdkRetries: number;
  abortedBy: AbortedBy;
}

type AttemptLog = { event: "attempt"; attempt: number } & (
  | (AnsweredCallLog & { outcome: "success"; finishReason: FinishReason })
  | (AnsweredCallLog & {
      outcome: "invalid-output";
      finishReason: FinishReason | undefined;
      /** The concrete error the retry receives. */
      validationError: string;
    })
  | FailedCallLog
  | AbortedCallLog
);

type StepLog = { event: "step"; step: number } & (
  | (AnsweredCallLog & {
      outcome: "success";
      finishReason: FinishReason;
      /** Until the first fragment of the step's output. */
      firstChunkMs: number | undefined;
      toolCalls: { toolName: string; input: unknown }[];
    })
  | FailedCallLog
);

/** The response of a request that never reached the model. */
type RejectedResponseLog = { event: "response"; outcome: "rejected" } & (
  | { status: 503; error: "reduced-mode" }
  | { status: 400; error: "invalid-request"; rejection: RequestRejection }
);

/** The end of a chat's stream, which always answered 200. */
type StreamedResponseLog = TokenCounts & {
  event: "response";
  outcome: "streamed";
  status: 200;
  steps: number;
  sdkRetries: number;
  totalMs: number;
  /** Until the first fragment of the answer's text. */
  firstChunkMs?: number;
  finishReason?: FinishReason;
  error?: ModelErrorCode;
  providerError?: ProviderErrorLog;
  /** Whose abort ended the answer. */
  abortedBy?: AbortedBy;
};

/**
 * Why an answered request failed: the model's own failures, or an output
 * that broke the rules on every attempt. The correction's codes are these.
 */
export type AnsweredErrorCode = ModelErrorCode | "invalid-output";

/** The answer of the correction after its last attempt. */
type AnsweredResponseLog = TokenCounts & {
  event: "response";
  outcome: "answered";
  attempts: number;
  sdkRetries: number;
  totalMs: number;
  finishReason: FinishReason | undefined;
  /** Whose abort ended the last attempt. */
  abortedBy?: AbortedBy;
} & (
    | { status: 200 }
    | { status: 429; error: "rate-limit" }
    | { status: 502; error: Exclude<AnsweredErrorCode, "rate-limit"> }
  );

export type AtomyLogEvent =
  | {
      event: "request";
      model: string;
      promptVersion: string;
      /** What the model reads besides the instructions. */
      input: unknown;
    }
  | AttemptLog
  | StepLog
  | RejectedResponseLog
  | StreamedResponseLog
  | AnsweredResponseLog;

export type AtomyLogLine = {
  atomy: AtomyEndpoint;
  requestId: string;
} & AtomyLogEvent;

export type AtomyLogSink = (line: AtomyLogLine) => void;

/** The log of one request: every line it writes carries the same id. */
export function requestLog(
  endpoint: AtomyEndpoint,
  sink: AtomyLogSink | undefined,
): (event: AtomyLogEvent) => void {
  const requestId = crypto.randomUUID();
  return (event) => sink?.({ atomy: endpoint, requestId, ...event });
}

/** One line of JSON per event, for the terminal and Next's dev log. */
export const consoleLogSink: AtomyLogSink = (line) => {
  console.info(JSON.stringify(line));
};

export function tokenCounts(
  usage: LanguageModelUsage | undefined,
): TokenCounts {
  return {
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    reasoningTokens: usage?.outputTokenDetails.reasoningTokens,
  };
}

function sum(a: number | undefined, b: number | undefined) {
  return a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0);
}

export function addTokenCounts(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    inputTokens: sum(a.inputTokens, b.inputTokens),
    outputTokens: sum(a.outputTokens, b.outputTokens),
    reasoningTokens: sum(a.reasoningTokens, b.reasoningTokens),
  };
}

export const NO_TOKENS: TokenCounts = {
  inputTokens: undefined,
  outputTokens: undefined,
  reasoningTokens: undefined,
};

/** A failed call as the log keeps it: name, HTTP status and message. */
export function providerErrorLog(error: unknown): ProviderErrorLog {
  if (RetryError.isInstance(error)) {
    return {
      name: error.name,
      message: error.message,
      errors: error.errors.map(providerErrorLog),
    };
  }
  if (APICallError.isInstance(error)) {
    return {
      name: error.name,
      message: error.message,
      ...(error.statusCode === undefined
        ? {}
        : { statusCode: error.statusCode }),
    };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "unknown", message: String(error) };
}

/** The retries the AI SDK made before giving up, from its error. */
export function sdkRetriesOf(error: unknown): number | undefined {
  return RetryError.isInstance(error)
    ? Math.max(0, error.errors.length - 1)
    : undefined;
}
