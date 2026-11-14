import { APICallError, RetryError, type LanguageModelUsage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { acceptRequest, callMetrics } from "@/lib/atomy/model-endpoint";
import type { ParsedRequest } from "@/lib/atomy/request-body";
import type { AtomyLogLine } from "@/lib/atomy/request-log";

function parse(body: string): ParsedRequest<{ question: string }> {
  return body === "ok"
    ? { success: true, data: { question: "¿Por qué?" } }
    : { success: false, rejection: { reason: "invalid-json" } };
}

function accept(
  model: MockLanguageModelV4 | null,
  body: string | Request,
  maxBodyChars = 100,
) {
  const lines: AtomyLogLine[] = [];
  const accepted = acceptRequest(
    typeof body === "string"
      ? new Request("http://localhost/api", { method: "POST", body })
      : body,
    {
      endpoint: "correction",
      model,
      parse,
      maxBodyChars,
      sink: (line) => lines.push(line),
      promptVersion: "test-v1",
      input: ({ question }) => `<pregunta>${question}</pregunta>`,
    },
  );
  return { accepted, lines };
}

function usage(inputTokens: number, outputTokens: number): LanguageModelUsage {
  return {
    inputTokens,
    inputTokenDetails: {
      noCacheTokens: undefined,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokens,
    outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
    totalTokens: inputTokens + outputTokens,
  };
}

describe("acceptRequest", () => {
  it("answers 503 without a model, before reading the body", async () => {
    const { accepted, lines } = accept(null, "ok");
    const result = await accepted;
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.response.status).toBe(503);
    expect(await result.response.json()).toEqual({ error: "reduced-mode" });
    expect(lines).toMatchObject([
      {
        event: "response",
        outcome: "rejected",
        status: 503,
        error: "reduced-mode",
      },
    ]);
  });

  it("answers 400 to an invalid body, with the reason in the log", async () => {
    const { accepted, lines } = accept(new MockLanguageModelV4(), "{");
    const result = await accepted;
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual({ error: "invalid-request" });
    expect(lines).toMatchObject([
      {
        event: "response",
        outcome: "rejected",
        status: 400,
        error: "invalid-request",
        rejection: { reason: "invalid-json" },
      },
    ]);
  });

  it("answers 400 to a body its length declares too large, without reading it", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: "ok",
      headers: { "content-length": "100000" },
    });
    const { accepted, lines } = accept(new MockLanguageModelV4(), request, 10);
    const result = await accepted;
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.response.status).toBe(400);
    expect(request.bodyUsed).toBe(false);
    expect(lines).toMatchObject([
      {
        status: 400,
        rejection: { reason: "body-too-large", bytes: 100_000, maxBytes: 30 },
      },
    ]);
  });

  it("stops reading a body once it grows past the limit", async () => {
    let chunks = 0;
    const body = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        chunks += 1;
        if (chunks > 100) controller.close();
        else controller.enqueue(new TextEncoder().encode("a".repeat(16)));
      },
    });
    // Node needs `duplex` for a body that streams; the DOM's types lack it.
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      body,
      duplex: "half",
    };
    const request = new Request("http://localhost/api", init);
    const { accepted, lines } = accept(new MockLanguageModelV4(), request, 10);
    const result = await accepted;
    expect(result.accepted).toBe(false);
    expect(chunks).toBeLessThan(10);
    expect(lines).toMatchObject([
      { status: 400, rejection: { reason: "body-too-large", maxBytes: 30 } },
    ]);
  });

  it("reads a body of the most characters, each of several bytes", async () => {
    const parsed = vi.fn(parse);
    const lines: AtomyLogLine[] = [];
    const body = "é".repeat(10);
    await acceptRequest(
      new Request("http://localhost/api", { method: "POST", body }),
      {
        endpoint: "correction",
        model: new MockLanguageModelV4(),
        parse: parsed,
        maxBodyChars: 10,
        sink: (line) => lines.push(line),
        promptVersion: "test-v1",
        input: ({ question }) => question,
      },
    );
    expect(parsed).toHaveBeenCalledWith(body);
  });

  it("logs a valid request with the model, the prompt version and the input", async () => {
    const model = new MockLanguageModelV4({ modelId: "main" });
    const { accepted, lines } = accept(model, "ok");
    const result = await accepted;
    expect(result).toMatchObject({
      accepted: true,
      body: { question: "¿Por qué?" },
      input: "<pregunta>¿Por qué?</pregunta>",
      model,
      modelId: "main",
    });
    expect(lines).toMatchObject([
      {
        atomy: "correction",
        event: "request",
        model: "main",
        promptVersion: "test-v1",
        input: "<pregunta>¿Por qué?</pregunta>",
      },
    ]);
  });
});

describe("callMetrics", () => {
  it("counts the calls beyond the first as the AI SDK's retries", () => {
    const metrics = callMetrics("main");
    metrics.start();
    metrics.onCallStart();
    metrics.onCallStart();
    expect(metrics.success(usage(10, 5), "main")).toMatchObject({
      inputTokens: 10,
      outputTokens: 5,
      sdkRetries: 1,
    });
    expect(metrics.sdkRetries()).toBe(1);
  });

  it("names the fallback model that answered instead of the main one", () => {
    const metrics = callMetrics("main");
    metrics.start();
    metrics.onCallStart();
    expect(metrics.success(usage(1, 1), "main")).not.toHaveProperty(
      "fallbackModel",
    );
    expect(metrics.success(usage(1, 1), "fallback")).toMatchObject({
      fallbackModel: "fallback",
    });
    expect(metrics.success(usage(1, 1))).not.toHaveProperty("fallbackModel");
  });

  it("adds every call's tokens and retries to the request's totals", () => {
    const metrics = callMetrics("main");
    metrics.start();
    metrics.onCallStart();
    metrics.success(usage(10, 5), "main");
    metrics.start();
    metrics.onCallStart();
    metrics.onCallStart();
    metrics.onCallStart();
    metrics.success(usage(20, 7), "main");
    expect(metrics.tokens()).toEqual({
      inputTokens: 30,
      outputTokens: 12,
      reasoningTokens: undefined,
    });
    expect(metrics.sdkRetries()).toBe(2);
  });

  it("takes a failure's retries from the AI SDK's error, without tokens", () => {
    const anyNumber: unknown = expect.any(Number);
    const failed = new APICallError({
      message: "overloaded",
      url: "https://example.test",
      requestBodyValues: {},
      statusCode: 503,
    });
    const metrics = callMetrics("main");
    metrics.start();
    metrics.onCallStart();
    expect(
      metrics.failure(
        new RetryError({
          message: "failed after 3 attempts",
          reason: "maxRetriesExceeded",
          errors: [failed, failed, failed],
        }),
      ),
    ).toEqual({ totalMs: anyNumber, sdkRetries: 2 });
    expect(metrics.sdkRetries()).toBe(2);
  });

  it("counts a failure's retries from its calls when the error does not say", () => {
    const metrics = callMetrics("main");
    metrics.start();
    metrics.onCallStart();
    metrics.onCallStart();
    expect(metrics.failure(new Error("timeout"))).toMatchObject({
      sdkRetries: 1,
    });
  });
});
