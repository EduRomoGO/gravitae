import { simulateReadableStream, type UIMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createFinderChatHandler } from "@/lib/atomy/finder-chat-handler";
import {
  FINDER_INSTRUCTIONS,
  FINDER_PROMPT_VERSION,
} from "@/lib/atomy/finder-chat-prompt";
import type { FinderSnapshot } from "@/lib/atomy/finder-chat-request";
import type { AtomyLogLine } from "@/lib/atomy/request-log";

const SNAPSHOT: FinderSnapshot = {
  seed: { vx: 0.36, vy: 0.52 },
  maxTime: 30,
  simulation: {
    status: "done",
    summary: {
      seed: { vx: 0.36, vy: 0.52 },
      maxTime: 30,
      outcome: "open",
      bestReturn: { time: 6.2, distance: 0.18 },
    },
  },
  closure: { status: "idle" },
};

function toolCallModel(toolName: string, input: unknown) {
  return new MockLanguageModelV4({
    doStream: () =>
      Promise.resolve({
        stream: simulateReadableStream({
          chunks: [
            {
              type: "tool-call" as const,
              toolCallId: "c1",
              toolName,
              input: JSON.stringify(input),
            },
            {
              type: "finish" as const,
              finishReason: { unified: "tool-calls" as const, raw: "STOP" },
              usage: {
                inputTokens: {
                  total: 100,
                  noCache: 100,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: { total: 10, text: 10, reasoning: undefined },
              },
            },
          ],
        }),
      }),
  });
}

function question(text: string): UIMessage {
  return { id: "u1", role: "user", parts: [{ type: "text", text }] };
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/atomy/finder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("createFinderChatHandler", () => {
  it("answers with the reduced mode without a model", async () => {
    const response = await createFinderChatHandler({ model: null })(
      post({ messages: [question("¿Qué es?")], snapshot: SNAPSHOT }),
    );

    expect(response.status).toBe(503);
  });

  it("rejects a request with the lesson's snapshot", async () => {
    const response = await createFinderChatHandler({
      model: toolCallModel("close_orbit", {}),
    })(
      post({
        messages: [question("¿Qué es?")],
        snapshot: { section: { id: "caida", title: "t", text: "x" } },
      }),
    );

    expect(response.status).toBe(400);
  });

  it("gives the model the finder's instructions, state and tools", async () => {
    const model = toolCallModel("close_orbit", {});
    const lines: AtomyLogLine[] = [];
    const response = await createFinderChatHandler({
      model,
      log: (line) => lines.push(line),
    })(post({ messages: [question("Ciérrala")], snapshot: SNAPSHOT }));
    const body = await response.text();

    const call = model.doStreamCalls[0];
    expect(call?.prompt[0]).toEqual({
      role: "system",
      content: FINDER_INSTRUCTIONS,
    });
    const prompt = JSON.stringify(call?.prompt);
    expect(prompt).toContain('mejor_regreso_t=\\"6.2\\"');
    expect(prompt).toContain("<pregunta_del_lector>");
    expect(call?.tools?.map(({ name }) => name)).toEqual([
      "set_seed",
      "start_from",
      "close_orbit",
    ]);
    expect(body).toContain('"toolName":"close_orbit"');
    expect(lines[0]).toMatchObject({
      atomy: "finder-chat",
      event: "request",
      promptVersion: FINDER_PROMPT_VERSION,
    });
  });
});
