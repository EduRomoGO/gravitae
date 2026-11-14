import { describe, expect, it } from "vitest";
import {
  outcomeOf,
  viewOf,
  type ChatMessage,
} from "@/components/atomy/chat-outcome";
import { FALLBACK_NOTE } from "@/components/atomy/fallback-note";

function question(text: string): ChatMessage {
  return { id: "q", role: "user", parts: [{ type: "text", text }] };
}

function answer(
  text: string,
  finishReason?: "stop" | "length" | "content-filter" | "error" | "other",
): ChatMessage {
  return {
    id: "a",
    role: "assistant",
    parts: [{ type: "text", text }],
    ...(finishReason ? { metadata: { finishReason } } : {}),
  };
}

describe("outcomeOf", () => {
  it("has no outcome before the first question", () => {
    expect(outcomeOf({ status: "ready", messages: [] })).toBeUndefined();
  });

  it("has no outcome while the answer arrives", () => {
    expect(
      outcomeOf({
        status: "streaming",
        messages: [question("¿Por qué?"), answer("Porque")],
      }),
    ).toBeUndefined();
    expect(
      outcomeOf({ status: "submitted", messages: [question("¿Por qué?")] }),
    ).toBeUndefined();
  });

  it("is answered once the answer ends", () => {
    expect(
      outcomeOf({
        status: "ready",
        messages: [question("¿Por qué?"), answer("Porque sí.", "stop")],
      }),
    ).toBe("answered");
  });

  it("is answered when the answer was cut by its length or blocked", () => {
    expect(
      outcomeOf({
        status: "ready",
        messages: [question("¿Por qué?"), answer("Porque", "length")],
      }),
    ).toBe("answered");
    expect(
      outcomeOf({
        status: "ready",
        messages: [question("¿Por qué?"), answer("", "content-filter")],
      }),
    ).toBe("answered");
  });

  it("failed when the model ended the answer with an error or without a reason", () => {
    expect(
      outcomeOf({
        status: "ready",
        messages: [question("¿Por qué?"), answer("", "error")],
      }),
    ).toBe("failed");
    expect(
      outcomeOf({
        status: "ready",
        messages: [question("¿Por qué?"), answer("", "other")],
      }),
    ).toBe("failed");
  });

  it("hit the rate limit when the request failed with its code", () => {
    expect(
      outcomeOf({
        status: "error",
        error: new Error("rate-limit"),
        messages: [question("¿Por qué?")],
      }),
    ).toBe("rate-limit");
  });

  it("failed when the request failed with any other error", () => {
    expect(
      outcomeOf({
        status: "error",
        error: new Error("provider"),
        messages: [question("¿Por qué?"), answer("Porque")],
      }),
    ).toBe("failed");
  });

  it("has no outcome while the last message is the reader's", () => {
    expect(
      outcomeOf({ status: "ready", messages: [question("¿Por qué?")] }),
    ).toBeUndefined();
  });
});

describe("viewOf, an answer from a fallback model", () => {
  function fallbackAnswer(
    finishReason: "stop" | "length",
  ): ChatMessage {
    return {
      id: "a",
      role: "assistant",
      parts: [{ type: "text", text: "Cae." }],
      metadata: { finishReason, fallback: true },
    };
  }

  it("warns that the answer may be worse, and Atomy stays idle", () => {
    const view = viewOf(
      { status: "ready", messages: [question("¿Por qué?"), fallbackAnswer("stop")] },
      undefined,
    );

    expect(view.messages.at(-1)?.note).toBe(FALLBACK_NOTE);
    expect(view.announcement).toBe(`Cae. ${FALLBACK_NOTE}`);
    expect(view.atomyState).toBe("idle");
  });

  it("adds the warning after how the answer ended", () => {
    const view = viewOf(
      { status: "ready", messages: [question("¿Por qué?"), fallbackAnswer("length")] },
      undefined,
    );

    expect(view.messages.at(-1)?.note).toBe(
      `Respuesta incompleta: se cortó por su longitud. ${FALLBACK_NOTE}`,
    );
    expect(view.atomyState).toBe("stopped");
  });
});
