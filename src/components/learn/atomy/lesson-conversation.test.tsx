import { act, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { lessonSurface } from "@/components/learn/atomy/lesson-surface";
import { PredictionBook } from "@/components/learn/atomy/chat-predictions";
import { useAtomyConversation } from "@/components/atomy/use-atomy-conversation";
import { MAX_MESSAGES } from "@/lib/atomy/chat-messages";

const ASTRONAUTS = { prediction: "mesa", question: "Astronautas" } as const;

const STREAM_HEADERS = {
  "content-type": "text/event-stream",
  "x-vercel-ai-ui-message-stream": "v1",
};

function uiStream(chunks: unknown[]): Response {
  return new Response(
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
      "data: [DONE]\n\n",
    { headers: STREAM_HEADERS },
  );
}

function textAnswer(text: string): Response {
  return uiStream([
    { type: "start" },
    { type: "start-step" },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish-step" },
    {
      type: "finish",
      finishReason: "stop",
      messageMetadata: { finishReason: "stop" },
    },
  ]);
}

function toolCallAnswer(toolName: string, input: unknown): Response {
  return uiStream([
    { type: "start" },
    { type: "start-step" },
    { type: "tool-input-available", toolCallId: "c1", toolName, input },
    { type: "finish-step" },
    {
      type: "finish",
      finishReason: "tool-calls",
      messageMetadata: { finishReason: "tool-calls" },
    },
  ]);
}

/** Stubs the route handler with these answers in turn; returns the bodies. */
function answerInTurn(answers: (() => Response)[]): { bodies: string[] } {
  const bodies: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
    bodies.push(typeof init?.body === "string" ? init.body : "");
    const answer = answers[Math.min(bodies.length, answers.length) - 1];
    if (!answer) throw new Error("No answer");
    return Promise.resolve(answer());
  });
  return { bodies };
}

const SECOND_TITLE = "Lo que tira de cada caja";

/** The lesson's sections, outside any chat panel. */
function renderLesson(): void {
  render(
    <main>
      <section id="caida" aria-labelledby="caida-titulo">
        <h2 id="caida-titulo">Empecemos soltando tres cajas</h2>
      </section>
      <section id="iguales" aria-labelledby="iguales-titulo">
        <h2 id="iguales-titulo">{SECOND_TITLE}</h2>
      </section>
    </main>,
  );
}

function renderConversation() {
  const predictions = new PredictionBook();
  return renderHook(() =>
    useAtomyConversation((context) =>
      lessonSurface(null, context, predictions),
    ),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAtomyConversation", () => {
  it("sends a question and ends with the model's answer", async () => {
    answerInTurn([() => textAnswer("Caen a la vez.")]);
    renderLesson();
    const { result } = renderConversation();

    act(() => {
      expect(result.current.send("¿Cuál cae antes?")).toBe(true);
    });

    await vi.waitFor(() => {
      expect(result.current.outcome).toBe("answered");
    });
    expect(result.current.messages.map(({ text }) => text)).toEqual([
      "¿En qué te puedo ayudar?",
      "¿Cuál cae antes?",
      "Caen a la vez.",
    ]);
    expect(result.current.announcement).toBe("Caen a la vez.");
  });

  it("runs a tool of the page and sends its result back", async () => {
    const { bodies } = answerInTurn([
      () => toolCallAnswer("go_to_section", { section: "iguales" }),
      () => textAnswer("Aquí lo tienes."),
    ]);
    renderLesson();
    const { result } = renderConversation();

    act(() => {
      result.current.send("Llévame a las cajas");
    });

    await vi.waitFor(() => {
      expect(result.current.outcome).toBe("answered");
    });
    const line = `Atomy te llevó a la sección «${SECOND_TITLE}».`;
    expect(result.current.lastAction).toBe(line);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toContain('"state":"output-available"');
  });

  it("starts anew when it opens about another experiment", async () => {
    answerInTurn([() => textAnswer("Caen a la vez.")]);
    renderLesson();
    const { result } = renderConversation();
    act(() => {
      result.current.send("¿Cuál cae antes?");
    });
    await vi.waitFor(() => {
      expect(result.current.outcome).toBe("answered");
    });

    act(() => {
      result.current.openWith(ASTRONAUTS);
    });

    expect(result.current.context).toEqual(ASTRONAUTS);
    expect(result.current.messages.map(({ text }) => text)).toEqual([
      "¿Qué duda tienes sobre este experimento?",
    ]);
  });

  it("keeps the conversation when the same experiment opens it with its question reworded", async () => {
    answerInTurn([() => textAnswer("Se juntan, pero tardan horas.")]);
    renderLesson();
    const { result } = renderConversation();
    act(() => {
      result.current.openWith(ASTRONAUTS);
    });
    act(() => {
      result.current.send("¿Cuánto tardan?");
    });
    await vi.waitFor(() => {
      expect(result.current.outcome).toBe("answered");
    });

    const reworded = {
      prediction: "mesa",
      question: "Dos astronautas",
    } as const;
    act(() => {
      result.current.openWith(reworded);
    });

    expect(result.current.context).toEqual(reworded);
    expect(result.current.messages.map(({ text }) => text)).toEqual([
      "¿Qué duda tienes sobre este experimento?",
      "¿Cuánto tardan?",
      "Se juntan, pero tardan horas.",
    ]);
  });

  it("sends only the latest messages the route handler accepts", async () => {
    const { bodies } = answerInTurn([() => textAnswer("Sí.")]);
    renderLesson();
    const { result } = renderConversation();
    const questions = MAX_MESSAGES / 2 + 1;

    for (let index = 0; index < questions; index += 1) {
      act(() => {
        expect(result.current.send(`Pregunta ${String(index)}`)).toBe(true);
      });
      // The greeting, then a question and its answer each.
      await vi.waitFor(() => {
        expect(result.current.messages).toHaveLength(2 * index + 3);
        expect(result.current.busy).toBe(false);
      });
    }

    const sent = z
      .object({ messages: z.array(z.object({ role: z.string() })) })
      .parse(JSON.parse(bodies.at(-1) ?? ""));
    expect(sent.messages).toHaveLength(MAX_MESSAGES - 1);
    expect(sent.messages[0]?.role).toBe("user");
    expect(result.current.messages).toHaveLength(2 * questions + 1);
  });

  it("starts a new conversation, about no experiment", async () => {
    answerInTurn([() => textAnswer("Caen a la vez.")]);
    renderLesson();
    const { result } = renderConversation();
    act(() => {
      result.current.openWith(ASTRONAUTS);
    });
    act(() => {
      result.current.send("¿Cuál cae antes?");
    });
    await vi.waitFor(() => {
      expect(result.current.outcome).toBe("answered");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.context).toBeUndefined();
    expect(result.current.messages.map(({ text }) => text)).toEqual([
      "¿En qué te puedo ayudar?",
    ]);
  });
});
