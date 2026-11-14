import { describe, expect, it } from "vitest";
import { parseFinderChatRequest } from "@/lib/atomy/finder-chat-request";
import { finderBlock } from "@/lib/atomy/finder-chat-prompt";

const SNAPSHOT = {
  seed: { vx: 0.36, vy: 0.52 },
  maxTime: 30,
  simulation: { status: "running" },
  closure: { status: "idle" },
} as const;

const QUESTION = {
  id: "u1",
  role: "user",
  parts: [{ type: "text", text: "Cierra la órbita" }],
};

function answerWith(part: object) {
  return { id: "a1", role: "assistant", parts: [part] };
}

describe("parseFinderChatRequest", () => {
  it("accepts a question with the finder's state", () => {
    expect(
      parseFinderChatRequest(
        JSON.stringify({ messages: [QUESTION], snapshot: SNAPSHOT }),
      ).success,
    ).toBe(true);
  });

  it("accepts Atomy's answer with a finder tool's result, to resend it", () => {
    const answer = answerWith({
      type: "tool-close_orbit",
      toolCallId: "c1",
      state: "output-available",
      input: {},
      output: { outcome: "collision" },
    });
    expect(
      parseFinderChatRequest(
        JSON.stringify({ messages: [QUESTION, answer], snapshot: SNAPSHOT }),
      ).success,
    ).toBe(true);
  });

  it("rejects a lesson tool in the finder's conversation", () => {
    const answer = answerWith({
      type: "tool-go_to_section",
      toolCallId: "c1",
      state: "output-available",
      input: { section: "caida" },
      output: { section: "caida", title: "t" },
    });
    expect(
      parseFinderChatRequest(
        JSON.stringify({ messages: [QUESTION, answer], snapshot: SNAPSHOT }),
      ).success,
    ).toBe(false);
  });

  it("rejects a seed outside the limits", () => {
    expect(
      parseFinderChatRequest(
        JSON.stringify({
          messages: [QUESTION],
          snapshot: { ...SNAPSHOT, seed: { vx: 4, vy: 0 } },
        }),
      ).success,
    ).toBe(false);
  });
});

describe("finderBlock", () => {
  it("writes the finder's state for the model", () => {
    expect(
      finderBlock({
        ...SNAPSHOT,
        simulation: {
          status: "done",
          summary: {
            seed: SNAPSHOT.seed,
            maxTime: 30,
            outcome: "collision",
            bestReturn: null,
          },
        },
      }),
    ).toBe(
      [
        "<buscador>",
        '<semilla vx="0.36" vy="0.52"/>',
        "<tiempo_simulado>30</tiempo_simulado>",
        '<simulacion estado="choque"/>',
        '<cierre estado="sin intentar"/>',
        "</buscador>",
      ].join("\n"),
    );
  });
});
