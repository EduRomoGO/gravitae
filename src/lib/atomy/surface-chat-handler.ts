// The chat with Atomy on any surface, server side: validates the request with
// the surface's parser, builds the prompt with the surface's conversation and
// streams Gemini's answer as a UI message stream with the surface's tools.
// Each surface (chat-handler.ts for the lesson, finder-chat-handler.ts for the
// orbit finder) passes its own ChatSurfaceServer. The route handler passes the
// model, or null without a key; tests pass a MockLanguageModelV4. Every
// request writes its log: the conversation, each step and the response.

import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type FinishReason,
  type Tool,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { MAX_BODY_CHARS } from "@/lib/atomy/chat-messages";
import type { ParsedRequest } from "@/lib/atomy/request-body";
import {
  acceptRequest,
  callMetrics,
  type ModelHandlerOptions,
} from "@/lib/atomy/model-endpoint";
import type { ModelErrorCode } from "@/lib/atomy/model-error-codes";
import { modelErrorCode } from "@/lib/atomy/model-errors";
import {
  providerErrorLog,
  type AtomyEndpoint,
  type ProviderErrorLog,
} from "@/lib/atomy/request-log";

/** About 4 short sentences in Spanish, with room to spare. */
export const CHAT_MAX_OUTPUT_TOKENS = 600;

/**
 * Model calls within one request: a round of calculations and the answer,
 * with room for one more round. Bounds the cost of a model that keeps
 * calling tools.
 */
export const CHAT_MAX_STEPS = 3;

/**
 * How long the chat waits for Gemini: for the first fragment
 * of each step, between fragments, and for the whole turn. Not measured yet
 * against the real model: generous for a flash model's answer of a few
 * sentences, short enough for the reader to retry. The handler's options
 * override them, for tests.
 */
export const CHAT_TIMEOUT = {
  firstChunkMs: 20_000,
  chunkMs: 10_000,
  totalMs: 60_000,
} as const satisfies ChatTimeout;

export interface ChatTimeout {
  firstChunkMs?: number;
  chunkMs?: number;
  totalMs?: number;
}

/**
 * What the chat learns of a failed answer, in the stream's error: a code the
 * chat turns into words for the reader, never the provider's own message.
 */
export type ChatErrorCode = ModelErrorCode;

/**
 * What the chat learns of each answer besides its text: why it ended, so it
 * can mark an answer cut by its length or blocked, and
 * whether a fallback model wrote it because the main one had run out of
 * quota, so it can warn that the answer may be worse. The finish reason
 * arrives at the end, the fallback with the step it wrote.
 */
export interface ChatAnswerMetadata {
  finishReason?: FinishReason;
  fallback?: true;
}

/**
 * A timeout aborts the answer as the reader's stop does. Only the reader's
 * own stop aborts the request: any other abort is a timeout, which the chat
 * shows as a provider failure. `ended` runs when the stream ends.
 */
function timeoutsAsErrors(
  request: Request,
  ended: () => void,
): TransformStream<UIMessageChunk, UIMessageChunk> {
  return new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(
        chunk.type === "abort" && !request.signal.aborted
          ? { type: "error", errorText: "provider" satisfies ChatErrorCode }
          : chunk,
      );
    },
    flush: ended,
  });
}

/** What the route handler of the chat passes to the chat. */
export type ChatHandlerOptions = ModelHandlerOptions<ChatTimeout>;

/**
 * The page the chat talks about, as the server sees it: how its requests are
 * validated, what the model is told and which tools it may call. The lesson
 * and the orbit finder are the two surfaces.
 */
export interface ChatSurfaceServer<Body extends { messages: UIMessage[] }> {
  readonly endpoint: AtomyEndpoint;
  readonly functionId: string;
  readonly instructions: string;
  readonly promptVersion: string;
  readonly parse: (body: string) => ParsedRequest<Body>;
  /** The conversation as the model reads it. */
  readonly conversation: (body: Body) => UIMessage[];
  readonly tools: (body: Body) => Record<string, Tool>;
  readonly activeTools: (body: Body) => string[];
}

/** The chat with Atomy on any surface, as a route handler. */
export function createSurfaceChatHandler<
  Body extends { messages: UIMessage[] },
>(
  surface: ChatSurfaceServer<Body>,
  { model, log: sink, timeout = CHAT_TIMEOUT }: ChatHandlerOptions,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const accepted = await acceptRequest(request, {
      endpoint: surface.endpoint,
      model,
      parse: surface.parse,
      maxBodyChars: MAX_BODY_CHARS,
      sink,
      promptVersion: surface.promptVersion,
      input: surface.conversation,
    });
    if (!accepted.accepted) return accepted.response;
    const { log, body, input: conversation, modelId: mainModelId } = accepted;
    const startedAt = performance.now();
    const metrics = callMetrics(mainModelId);
    let firstChunkMs: number | undefined;
    let steps = 0;
    let finishReason: FinishReason | undefined;
    let error: ChatErrorCode | undefined;
    let providerError: ProviderErrorLog | undefined;
    let abortedBy: "reader" | "timeout" | undefined;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      log({
        event: "response",
        outcome: "streamed",
        status: 200,
        ...(error ? { error } : {}),
        ...(providerError ? { providerError } : {}),
        ...(abortedBy ? { abortedBy } : {}),
        steps,
        sdkRetries: metrics.sdkRetries(),
        ...metrics.tokens(),
        ...(finishReason ? { finishReason } : {}),
        ...(firstChunkMs === undefined ? {} : { firstChunkMs }),
        totalMs: performance.now() - startedAt,
      });
    };
    const result = streamText({
      model: accepted.model,
      telemetry: { functionId: surface.functionId },
      instructions: surface.instructions,
      messages: await convertToModelMessages(conversation),
      maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
      tools: surface.tools(body),
      activeTools: surface.activeTools(body),
      stopWhen: isStepCount(CHAT_MAX_STEPS),
      abortSignal: request.signal,
      timeout,
      onStepStart: () => {
        steps += 1;
        metrics.start();
      },
      onLanguageModelCallStart: metrics.onCallStart,
      onChunk: ({ chunk }) => {
        if (chunk.type === "text-delta" && firstChunkMs === undefined) {
          firstChunkMs = performance.now() - startedAt;
        }
      },
      onStepEnd: (step) => {
        finishReason = step.finishReason;
        log({
          event: "step",
          step: step.stepNumber + 1,
          outcome: "success",
          finishReason: step.finishReason,
          ...metrics.success(step.usage, step.response.modelId),
          firstChunkMs: step.performance.timeToFirstOutputMs,
          text: step.text,
          toolCalls: step.toolCalls.map(
            ({ toolName, input }: { toolName: string; input: unknown }) => ({
              toolName,
              input,
            }),
          ),
        });
      },
      onStepError: ({ stepNumber, error: stepError }) => {
        log({
          event: "step",
          step: stepNumber + 1,
          outcome: "provider-error",
          ...metrics.failure(stepError),
          providerError: providerErrorLog(stepError),
        });
      },
      onAbort: () => {
        abortedBy = request.signal.aborted ? "reader" : "timeout";
        if (abortedBy === "timeout") error = "provider";
        // The reader's stop may cancel the response before its stream ends.
        else end();
      },
    });
    return createUIMessageStreamResponse({
      // Only text reaches the reader: no reasoning parts, which the chat
      // would also send back in the next request's history.
      stream: toUIMessageStream({
        stream: result.stream,
        sendReasoning: false,
        onError: (streamError) => {
          error = modelErrorCode(streamError);
          providerError = providerErrorLog(streamError);
          return error;
        },
        messageMetadata: ({ part }): ChatAnswerMetadata | undefined =>
          part.type === "finish"
            ? { finishReason: part.finishReason }
            : part.type === "finish-step" &&
                part.response.modelId !== mainModelId
              ? { fallback: true }
              : undefined,
      }).pipeThrough(timeoutsAsErrors(request, end)),
    });
  };
}
