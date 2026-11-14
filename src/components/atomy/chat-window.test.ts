import { describe, expect, it } from "vitest";
import { recentMessages } from "@/components/atomy/chat-window";
import { MAX_MESSAGES } from "@/lib/atomy/chat-messages";

type Role = "user" | "assistant";

/** Question and answer in turn: user 0, assistant 1, user 2… */
function conversation(length: number): { id: string; role: Role }[] {
  return Array.from({ length }, (_, index) => ({
    id: String(index),
    role: index % 2 === 0 ? "user" : "assistant",
  }));
}

const ids = (messages: readonly { id: string }[]) =>
  messages.map(({ id }) => id);

describe("recentMessages", () => {
  it("keeps a conversation that fits", () => {
    const messages = conversation(MAX_MESSAGES);

    expect(recentMessages(messages)).toEqual(messages);
  });

  it("keeps the latest messages of a longer one, from a question on", () => {
    // Ten answered questions and the eleventh: the window would start with
    // an answer, which goes.
    const messages = conversation(MAX_MESSAGES + 1);

    const recent = recentMessages(messages);

    expect(recent).toHaveLength(MAX_MESSAGES - 1);
    expect(recent[0]?.role).toBe("user");
    expect(recent.at(-1)).toBe(messages.at(-1));
  });

  it("drops an answer left at the start without its question", () => {
    const messages = conversation(6);

    expect(ids(recentMessages(messages, 3))).toEqual(["4", "5"]);
  });

  it("keeps an answer that continues after the page's tools", () => {
    const messages = conversation(MAX_MESSAGES + 2);

    const recent = recentMessages(messages);

    expect(recent.at(-1)?.role).toBe("assistant");
    expect(recent[0]?.role).toBe("user");
    expect(recent.length).toBeLessThanOrEqual(MAX_MESSAGES);
  });
});
