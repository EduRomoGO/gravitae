import { APICallError, generateText, simulateReadableStream, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { fallbackModel, isQuotaError } from "@/lib/atomy/model-fallback";

const USAGE = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 2, text: 2, reasoning: undefined },
};

function providerError(statusCode: number): APICallError {
  return new APICallError({
    message: `Provider answered ${String(statusCode)}`,
    url: "https://generativelanguage.googleapis.com",
    requestBodyValues: {},
    statusCode,
    // No backoff: the tests do not wait for the AI SDK's retries.
    responseHeaders: { "retry-after-ms": "0" },
    isRetryable: statusCode === 429 || statusCode >= 500,
  });
}

/** A model that answers `text`, or fails with `failure` on every call. */
function model(modelId: string, failure?: number) {
  return new MockLanguageModelV4({
    modelId,
    doGenerate: () =>
      failure
        ? Promise.reject(providerError(failure))
        : Promise.resolve({
            content: [{ type: "text", text: modelId }],
            finishReason: { unified: "stop", raw: "STOP" },
            usage: USAGE,
            warnings: [],
          }),
    doStream: () =>
      failure
        ? Promise.reject(providerError(failure))
        : Promise.resolve({
            stream: simulateReadableStream({
              chunks: [
                { type: "stream-start", warnings: [] },
                { type: "response-metadata", id: "response-1" },
                { type: "text-start", id: "t1" },
                { type: "text-delta", id: "t1", delta: modelId },
                { type: "text-end", id: "t1" },
                {
                  type: "finish",
                  finishReason: { unified: "stop", raw: "STOP" },
                  usage: USAGE,
                },
              ],
            }),
          }),
  });
}

async function generated(chain: ReturnType<typeof fallbackModel>) {
  const result = await generateText({
    model: chain,
    prompt: "¿Por qué cae?",
    maxRetries: 0,
  });
  return { text: result.text, modelId: result.finalStep.response.modelId };
}

async function streamed(chain: ReturnType<typeof fallbackModel>) {
  let failure: unknown;
  const result = streamText({
    model: chain,
    prompt: "¿Por qué cae?",
    maxRetries: 0,
    onError: ({ error }) => {
      failure = error;
    },
  });
  // Without output, the stream's own error is the one the handler reports.
  const text = await Promise.resolve(result.text).catch((error: unknown) => {
    throw failure ?? error;
  });
  return { text, modelId: (await result.finalStep).response.modelId };
}

describe("isQuotaError", () => {
  it("is a 429 of the provider, and nothing else", () => {
    expect(isQuotaError(providerError(429))).toBe(true);
    expect(isQuotaError(providerError(503))).toBe(false);
    expect(isQuotaError(new Error("429"))).toBe(false);
  });
});

describe.each([
  ["generate", generated],
  ["stream", streamed],
] as const)("fallbackModel, %s", (_, call) => {
  it("answers with the main model while it has quota, under its id", async () => {
    const second = model("second");
    const chain = fallbackModel(model("main"), [second]);

    await expect(call(chain)).resolves.toEqual({
      text: "main",
      modelId: "main",
    });
    expect(second.doGenerateCalls).toHaveLength(0);
    expect(second.doStreamCalls).toHaveLength(0);
  });

  it("moves on a 429 to the next model, which names itself", async () => {
    const chain = fallbackModel(model("main", 429), [
      model("second", 429),
      model("third"),
    ]);

    await expect(call(chain)).resolves.toEqual({
      text: "third",
      modelId: "third",
    });
  });

  it("keeps any other failure, without asking the next model", async () => {
    const second = model("second");
    const chain = fallbackModel(model("main", 503), [second]);

    await expect(call(chain)).rejects.toMatchObject({ statusCode: 503 });
    expect(second.doGenerateCalls).toHaveLength(0);
    expect(second.doStreamCalls).toHaveLength(0);
  });

  it("fails with the last model's 429 when every one has run out", async () => {
    const chain = fallbackModel(model("main", 429), [model("second", 429)]);

    await expect(call(chain)).rejects.toMatchObject({ statusCode: 429 });
  });

  it("is the main model itself without fallbacks", async () => {
    const main = model("main");

    expect(fallbackModel(main, [])).toBe(main);
    await expect(call(fallbackModel(main, []))).resolves.toEqual({
      text: "main",
      modelId: "main",
    });
  });
});
