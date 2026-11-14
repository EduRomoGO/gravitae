// The models that answer when the main one has run out of quota: Google
// counts the free tier's quota per project and per model, so the same key
// still reaches another model after a 429. Each call tries the main model
// first and moves to the next only on a 429; any other error, or the last
// model's 429, reaches the AI SDK as it came, whose retries then run the
// whole chain again. The model that answered is the response's modelId: the
// handlers compare it with the main one to tell the reader.

import {
  APICallError,
  wrapLanguageModel,
  type LanguageModelMiddleware,
} from "ai";

/** A provider's model, as the AI SDK's current providers build it. */
export type ProviderModel = Extract<
  Parameters<typeof wrapLanguageModel>[0]["model"],
  { specificationVersion: "v4" }
>;

type StreamResult = Awaited<ReturnType<ProviderModel["doStream"]>>;
type StreamPart =
  StreamResult["stream"] extends ReadableStream<infer Part> ? Part : never;

/** The provider's answer when the model's quota has run out. */
export function isQuotaError(error: unknown): boolean {
  return APICallError.isInstance(error) && error.statusCode === 429;
}

/** The first call that does not run out of quota, or the last one's error. */
async function firstWithQuota<T>(
  calls: readonly (() => PromiseLike<T>)[],
): Promise<T> {
  for (const [index, call] of calls.entries()) {
    try {
      return await call();
    } catch (error) {
      if (index === calls.length - 1 || !isQuotaError(error)) throw error;
    }
  }
  throw new Error("firstWithQuota needs at least one call");
}

/**
 * The stream with the answering model's id in its response metadata, after
 * the stream's start: the provider's own metadata, without a modelId, keeps it.
 */
function withModelId(
  stream: ReadableStream<StreamPart>,
  modelId: string,
): ReadableStream<StreamPart> {
  let sent = false;
  const metadata: StreamPart = { type: "response-metadata", modelId };
  return stream.pipeThrough(
    new TransformStream<StreamPart, StreamPart>({
      transform(part, controller) {
        const first = !sent;
        sent = true;
        const starts = part.type === "stream-start";
        if (first && !starts) controller.enqueue(metadata);
        controller.enqueue(part);
        if (first && starts) controller.enqueue(metadata);
      },
    }),
  );
}

/** The main model, followed by the fallbacks in order when it runs out. */
export function fallbackModel(
  main: ProviderModel,
  fallbacks: readonly ProviderModel[],
): ProviderModel {
  if (fallbacks.length === 0) return main;
  const middleware: LanguageModelMiddleware = {
    specificationVersion: "v4",
    wrapGenerate: ({ doGenerate, params }) =>
      firstWithQuota([
        doGenerate,
        ...fallbacks.map((model) => async () => {
          const result = await model.doGenerate(params);
          return {
            ...result,
            response: {
              ...result.response,
              modelId: result.response?.modelId ?? model.modelId,
            },
          };
        }),
      ]),
    wrapStream: ({ doStream, params }) =>
      firstWithQuota([
        doStream,
        ...fallbacks.map((model) => async () => {
          const result = await model.doStream(params);
          return {
            ...result,
            stream: withModelId(result.stream, model.modelId),
          };
        }),
      ]),
  };
  return wrapLanguageModel({ model: main, middleware });
}
