import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { loadLessonChatPanel } from "@tests/support/lesson-chat-panel";
import { z } from "zod";
import { useOpenChat } from "@/components/atomy/atomy-chat";
import { LessonChat } from "@/components/learn/atomy/lesson-chat";
import { AtomyModeProvider, STATUS_URL } from "@/components/shared/atomy-mode";
import { Astronauts } from "@/components/learn/experiments/astronauts";
import { LessonSection } from "@/components/learn/lesson/lesson-section";
import { LessonControllerProvider } from "@/components/learn/lesson-controller";
import { ProgressProvider } from "@/components/shared/progress";
import {
  createProgressStore,
  progressStorageKey,
} from "@/lib/progress/progress-store";
import { MAX_AUTOMATIC_RESENDS } from "@/lib/atomy/client-tools";
import type { PredictionId } from "@/lib/lesson/predictions";

beforeAll(loadLessonChatPanel);

const DOCK = "Pregúntale a Atomy";
const SECTION_TITLE = "Empecemos soltando tres cajas";
const SECTION_TEXT = "Sueltas a la vez tres cajas iguales.";

/** A section of the lesson, as the page renders it. */
function Lesson({ children }: { children?: ReactNode }): ReactElement {
  return (
    <section id="caida" aria-labelledby="caida-titulo">
      <h2 id="caida-titulo">{SECTION_TITLE}</h2>
      <p>{SECTION_TEXT}</p>
      {children}
    </section>
  );
}

function uiStream(chunks: unknown[]): string {
  return (
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
    "data: [DONE]\n\n"
  );
}

const STREAM_HEADERS = {
  "content-type": "text/event-stream",
  "x-vercel-ai-ui-message-stream": "v1",
};

/** The route handler's answer: a UI message stream with these fragments. */
function streamedAnswer(fragments: string[], finishReason = "stop"): Response {
  const chunks = [
    { type: "start" },
    { type: "start-step" },
    { type: "text-start", id: "t1" },
    ...fragments.map((delta) => ({ type: "text-delta", id: "t1", delta })),
    { type: "text-end", id: "t1" },
    { type: "finish-step" },
    { type: "finish", finishReason, messageMetadata: { finishReason } },
  ];
  return new Response(uiStream(chunks), { headers: STREAM_HEADERS });
}

/** The route handler's answer when the model failed, with the error's code. */
function failedAnswer(errorText: string): Response {
  return new Response(
    uiStream([{ type: "start" }, { type: "error", errorText }]),
    { headers: STREAM_HEADERS },
  );
}

/**
 * Stubs the route handler with an answer that sends its first fragment and
 * waits, until the request is aborted.
 */
function answerThatHangsAfter(fragment: string): void {
  vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            uiStream([
              { type: "start" },
              { type: "start-step" },
              { type: "text-start", id: "t1" },
              { type: "text-delta", id: "t1", delta: fragment },
            ]).replace("data: [DONE]\n\n", ""),
          ),
        );
        init?.signal?.addEventListener("abort", () => {
          controller.error(init.signal?.reason);
        });
      },
    });
    return Promise.resolve(new Response(body, { headers: STREAM_HEADERS }));
  });
}

/** The conversation's messages, without the live region that repeats them. */
function conversation(): HTMLElement {
  return within(chat()).getByRole("list");
}

/** The polite live region where the chat announces each finished answer. */
function announcement(): string {
  return within(chat()).getByRole("status").textContent;
}

/** The JSON body the chat sent in a request. */
function requestBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== "string") throw new Error("No JSON body");
  return JSON.parse(init.body);
}

/** Stubs the route handler; returns the bodies of the requests it received. */
function answerWith(fragments: string[]): { bodies: unknown[] } {
  const bodies: unknown[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
    bodies.push(requestBody(init));
    return Promise.resolve(streamedAnswer(fragments));
  });
  return { bodies };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

async function ask(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole("textbox", { name: "Tu pregunta" }), text);
  await user.click(screen.getByRole("button", { name: "Enviar" }));
}

function AskAbout({
  context,
  prediction = "caida",
}: {
  context: string;
  prediction?: PredictionId;
}): ReactElement {
  const openChat = useOpenChat();
  return (
    <button
      type="button"
      onClick={() => openChat?.({ prediction, question: context })}
    >
      {`Preguntar sobre ${context}`}
    </button>
  );
}

function OutsideTheChat(): ReactElement {
  return <p>{useOpenChat() === null ? "Sin chat" : "Con chat"}</p>;
}

/** The state Atomy's drawing shows in the corner button. */
function dockAtomy(): string | null {
  return (
    screen
      .getByRole("button", { name: DOCK })
      .querySelector("svg")
      ?.getAttribute("data-state") ?? null
  );
}

/** Stubs the route handler with an answer that waits until it is released. */
function answerLater(fragments: string[]): { release: () => void } {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    await held;
    return streamedAnswer(fragments);
  });
  return { release };
}

function chat(): HTMLElement {
  return screen.getByRole("region", { name: "Chat con Atomy" });
}

describe("LessonChat", () => {
  it("shows its lesson and Atomy's closed button in the corner", () => {
    render(
      <LessonChat>
        <p>La lección</p>
      </LessonChat>,
    );

    expect(screen.getByText("La lección")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: DOCK })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      screen.queryByRole("region", { name: "Chat con Atomy" }),
    ).not.toBeInTheDocument();
  });

  it("opens from the corner with a general greeting and closes again", async () => {
    const user = userEvent.setup();
    render(<LessonChat>{null}</LessonChat>);

    await user.click(screen.getByRole("button", { name: DOCK }));

    expect(screen.getByRole("button", { name: DOCK })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(chat()).toHaveTextContent("¿En qué te puedo ayudar?");
    expect(chat()).not.toHaveTextContent("Sobre:");

    await user.click(screen.getByRole("button", { name: DOCK }));
    expect(
      screen.queryByRole("region", { name: "Chat con Atomy" }),
    ).not.toBeInTheDocument();
  });

  it("closes from its own close button", async () => {
    const user = userEvent.setup();
    render(<LessonChat>{null}</LessonChat>);
    await user.click(screen.getByRole("button", { name: DOCK }));

    await user.click(screen.getByRole("button", { name: "Cerrar el chat" }));

    expect(
      screen.queryByRole("region", { name: "Chat con Atomy" }),
    ).not.toBeInTheDocument();
  });

  it("answers each question with the language model's reply", async () => {
    answerWith(["La caja ", "cae antes ", "en la Tierra."]);
    const user = userEvent.setup();
    render(
      <LessonChat>
        <Lesson />
      </LessonChat>,
    );
    await user.click(screen.getByRole("button", { name: DOCK }));

    await ask(user, "¿Por qué cae la manzana?");

    await vi.waitFor(() => {
      const messages = within(chat()).getAllByRole("listitem");
      expect(messages.map((message) => message.textContent)).toEqual([
        "¿En qué te puedo ayudar?",
        "¿Por qué cae la manzana?",
        "La caja cae antes en la Tierra.",
      ]);
    });
    expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toHaveValue(
      "",
    );
  });

  it("sends the question with the section the reader is looking at", async () => {
    const { bodies } = answerWith(["Vale."]);
    const user = userEvent.setup();
    render(
      <LessonChat>
        <Lesson />
      </LessonChat>,
    );
    await user.click(screen.getByRole("button", { name: DOCK }));

    await ask(user, "¿Por qué cae la manzana?");

    await vi.waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({
      messages: [
        {
          role: "user",
          parts: [{ type: "text", text: "¿Por qué cae la manzana?" }],
        },
      ],
      snapshot: {
        section: { id: "caida", title: SECTION_TITLE },
      },
    });
    expect(JSON.stringify(bodies[0])).toContain(SECTION_TEXT);
    expect(JSON.stringify(bodies[0])).not.toContain("¿En qué te puedo ayudar?");
  });

  it("shows the reply as plain text, without links or images", async () => {
    answerWith(["Mira [esto](https://example.com) y <img src=x alt=foto>"]);
    const user = userEvent.setup();
    render(
      <LessonChat>
        <Lesson />
      </LessonChat>,
    );
    await user.click(screen.getByRole("button", { name: DOCK }));

    await ask(user, "¿Algo más?");

    await vi.waitFor(() => {
      expect(chat()).toHaveTextContent(
        "Mira [esto](https://example.com) y <img src=x alt=foto>",
      );
    });
    expect(within(chat()).queryByRole("link")).not.toBeInTheDocument();
    expect(
      within(chat()).queryByRole("img", { name: "foto" }),
    ).not.toBeInTheDocument();
  });

  it("sends nothing while the question is blank", async () => {
    const { bodies } = answerWith(["No debería llegar."]);
    const user = userEvent.setup();
    render(<LessonChat>{null}</LessonChat>);
    await user.click(screen.getByRole("button", { name: DOCK }));

    await user.type(screen.getByRole("textbox", { name: "Tu pregunta" }), "  ");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(within(chat()).getAllByRole("listitem")).toHaveLength(1);
    expect(bodies).toHaveLength(0);
  });

  it("opens about an experiment, and asks with that experiment as context", async () => {
    const { bodies } = answerWith(["En Marte cae más despacio."]);
    const user = userEvent.setup();
    render(
      <LessonChat>
        <Lesson>
          <AskAbout context="la caída" />
        </Lesson>
      </LessonChat>,
    );

    await user.click(
      screen.getByRole("button", { name: "Preguntar sobre la caída" }),
    );
    await ask(user, "¿Y en Marte?");

    expect(chat()).toHaveTextContent("Sobre: la caída");
    expect(chat()).toHaveTextContent(
      "¿Qué duda tienes sobre este experimento?",
    );
    await vi.waitFor(() => {
      expect(chat()).toHaveTextContent("En Marte cae más despacio.");
    });
    expect(bodies[0]).toMatchObject({ snapshot: { experiment: "la caída" } });
  });

  it("keeps the conversation when the same experiment opens it again, and starts anew for another one", async () => {
    answerWith(["Hola."]);
    const user = userEvent.setup();
    render(
      <LessonChat>
        <Lesson>
          <AskAbout context="la caída" />
          <AskAbout context="el ascensor" prediction="distancia" />
        </Lesson>
      </LessonChat>,
    );
    await user.click(
      screen.getByRole("button", { name: "Preguntar sobre la caída" }),
    );
    await ask(user, "Hola");
    await vi.waitFor(() => {
      expect(within(chat()).getAllByRole("listitem")).toHaveLength(3);
    });

    await user.click(
      screen.getByRole("button", { name: "Preguntar sobre la caída" }),
    );
    expect(within(chat()).getAllByRole("listitem")).toHaveLength(3);

    await user.click(
      screen.getByRole("button", { name: "Preguntar sobre el ascensor" }),
    );
    expect(chat()).toHaveTextContent("Sobre: el ascensor");
    expect(within(chat()).getAllByRole("listitem")).toHaveLength(1);
  });

  it("starts a new conversation from its header, with focus on the question", async () => {
    answerWith(["Hola."]);
    const user = userEvent.setup();
    render(
      <LessonChat>
        <Lesson>
          <AskAbout context="la caída" />
        </Lesson>
      </LessonChat>,
    );
    await user.click(
      screen.getByRole("button", { name: "Preguntar sobre la caída" }),
    );
    expect(
      within(chat()).queryByRole("button", { name: "Nueva conversación" }),
    ).not.toBeInTheDocument();
    await ask(user, "Hola");
    await vi.waitFor(() => {
      expect(within(chat()).getAllByRole("listitem")).toHaveLength(3);
    });

    await user.click(
      within(chat()).getByRole("button", { name: "Nueva conversación" }),
    );

    expect(chat()).not.toHaveTextContent("Sobre:");
    expect(within(chat()).getAllByRole("listitem")).toHaveLength(1);
    expect(
      within(chat()).queryByRole("button", { name: "Nueva conversación" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toHaveFocus();
  });

  it("keeps the conversation when the reader closes the chat and opens it again from the corner", async () => {
    answerWith(["Hola."]);
    const user = userEvent.setup();
    render(
      <LessonChat>
        <Lesson>
          <AskAbout context="la caída" />
        </Lesson>
      </LessonChat>,
    );
    await user.click(screen.getByRole("button", { name: DOCK }));
    await ask(user, "Hola");
    await vi.waitFor(() => {
      expect(within(chat()).getAllByRole("listitem")).toHaveLength(3);
    });

    await user.click(screen.getByRole("button", { name: "Cerrar el chat" }));
    await user.click(screen.getByRole("button", { name: DOCK }));
    expect(within(chat()).getAllByRole("listitem")).toHaveLength(3);

    await user.click(
      screen.getByRole("button", { name: "Preguntar sobre la caída" }),
    );
    await ask(user, "Otra");
    await vi.waitFor(() => {
      expect(within(chat()).getAllByRole("listitem")).toHaveLength(3);
    });
    await user.click(screen.getByRole("button", { name: DOCK }));
    await user.click(screen.getByRole("button", { name: DOCK }));

    expect(chat()).toHaveTextContent("Sobre: la caída");
    expect(within(chat()).getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows Atomy waiting, talking while the answer arrives, and waiting again once it ends", async () => {
    const { release } = answerLater(["Porque la atrae la Tierra."]);
    const user = userEvent.setup();
    render(
      <LessonChat>
        <Lesson />
      </LessonChat>,
    );
    await user.click(screen.getByRole("button", { name: DOCK }));
    expect(dockAtomy()).toBe("idle");

    await ask(user, "¿Por qué cae la manzana?");
    await vi.waitFor(() => {
      expect(dockAtomy()).toBe("talking");
    });

    release();
    await vi.waitFor(() => {
      expect(chat()).toHaveTextContent("Porque la atrae la Tierra.");
    });
    expect(dockAtomy()).toBe("idle");
  });

  it("stops Atomy when the answer fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "upstream" }, { status: 500 }),
    );
    const user = userEvent.setup();
    render(
      <LessonChat>
        <Lesson />
      </LessonChat>,
    );
    await user.click(screen.getByRole("button", { name: DOCK }));

    await ask(user, "¿Por qué cae la manzana?");

    await vi.waitFor(() => {
      expect(dockAtomy()).toBe("stopped");
    });
  });

  it("asks again, fresh, whether the model can be reached after the answer fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) =>
      Promise.resolve(
        typeof url === "string" && url.startsWith(STATUS_URL)
          ? Response.json({ status: "available" })
          : Response.json({ error: "upstream" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    render(
      <AtomyModeProvider>
        <LessonChat>
          <Lesson />
        </LessonChat>
      </AtomyModeProvider>,
    );
    await user.click(screen.getByRole("button", { name: DOCK }));

    await ask(user, "¿Por qué cae la manzana?");

    await vi.waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${STATUS_URL}?fresh`,
        expect.anything(),
      );
    });
  });

  it("only wraps its children while disabled, and keeps them mounted across the change", async () => {
    const user = userEvent.setup();
    function Counter() {
      const [count, setCount] = useState(0);
      return (
        <button
          type="button"
          onClick={() => {
            setCount(count + 1);
          }}
        >
          {`Contador ${String(count)}`}
        </button>
      );
    }
    const { rerender } = render(
      <LessonChat>
        <Counter />
      </LessonChat>,
    );
    await user.click(screen.getByRole("button", { name: "Contador 0" }));

    rerender(
      <LessonChat enabled={false}>
        <Counter />
      </LessonChat>,
    );

    expect(
      screen.queryByRole("button", { name: DOCK }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Contador 1" }),
    ).toBeInTheDocument();
  });

  it("offers no chat outside the advanced mode", () => {
    render(<OutsideTheChat />);

    expect(screen.getByText("Sin chat")).toBeInTheDocument();
  });
});

describe("LessonChat, while an answer arrives and when it goes wrong,", () => {
  async function openChat(user: ReturnType<typeof userEvent.setup>) {
    render(
      <LessonChat>
        <Lesson />
      </LessonChat>,
    );
    await user.click(screen.getByRole("button", { name: DOCK }));
  }

  it("shows that Atomy is thinking until the first fragment arrives", async () => {
    const { release } = answerLater(["Porque la atrae la Tierra."]);
    const user = userEvent.setup();
    await openChat(user);

    await ask(user, "¿Por qué cae?");

    expect(
      await within(chat()).findByText("Atomy está pensando…"),
    ).toBeVisible();
    release();
    await vi.waitFor(() => {
      expect(chat()).toHaveTextContent("Porque la atrae la Tierra.");
    });
    expect(within(chat()).queryByText("Atomy está pensando…")).toBeNull();
  });

  it("stops an answer on its way, keeping its text so far, and leaves Atomy waiting", async () => {
    answerThatHangsAfter("La caja cae ");
    const user = userEvent.setup();
    await openChat(user);
    await ask(user, "¿Por qué cae?");
    await vi.waitFor(() => {
      expect(chat()).toHaveTextContent("La caja cae");
    });

    await user.click(
      within(chat()).getByRole("button", { name: "Detener la respuesta" }),
    );

    await vi.waitFor(() => {
      expect(dockAtomy()).toBe("idle");
    });
    expect(chat()).toHaveTextContent("La caja cae");
    expect(
      within(chat()).getByRole("button", { name: "Enviar" }),
    ).toBeInTheDocument();
  });

  /** Stubs the route handler with these answers, one per request, the last repeated. */
  function answerInTurn(responses: (() => Response)[]): { bodies: unknown[] } {
    const bodies: unknown[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      bodies.push(requestBody(init));
      const next = responses[Math.min(bodies.length, responses.length) - 1];
      return Promise.resolve(next ? next() : failedAnswer("provider"));
    });
    return { bodies };
  }

  it("says the usage limit was reached on a 429, and stops Atomy", async () => {
    answerInTurn([() => failedAnswer("rate-limit")]);
    const user = userEvent.setup();
    await openChat(user);

    await ask(user, "¿Por qué cae?");

    expect(
      await within(conversation()).findByText(
        "Límite de uso alcanzado, inténtalo más tarde.",
      ),
    ).toBeVisible();
    expect(dockAtomy()).toBe("stopped");
    expect(
      within(chat()).getByRole("button", { name: "Seguir leyendo" }),
    ).toBeInTheDocument();
  });

  it("says the answer failed, offers to retry or keep reading, and stops Atomy", async () => {
    answerInTurn([() => failedAnswer("provider")]);
    const user = userEvent.setup();
    await openChat(user);

    await ask(user, "¿Por qué cae?");

    expect(
      await within(conversation()).findByText(/Atomy no ha podido responder/),
    ).toBeVisible();
    expect(dockAtomy()).toBe("stopped");
    expect(
      within(chat()).getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    expect(
      within(chat()).getByRole("button", { name: "Seguir leyendo" }),
    ).toBeInTheDocument();
  });

  it("treats an answer the model ended with an error as a failure", async () => {
    answerInTurn([() => streamedAnswer([], "error")]);
    const user = userEvent.setup();
    await openChat(user);

    await ask(user, "¿Por qué cae?");

    expect(
      await within(chat()).findByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    expect(dockAtomy()).toBe("stopped");
  });

  it("retries by sending the last question again", async () => {
    const { bodies } = answerInTurn([
      () => failedAnswer("provider"),
      () => streamedAnswer(["Porque la atrae la Tierra."]),
    ]);
    const user = userEvent.setup();
    await openChat(user);
    await ask(user, "¿Por qué cae?");

    await user.click(
      await within(chat()).findByRole("button", { name: "Reintentar" }),
    );

    await vi.waitFor(() => {
      expect(chat()).toHaveTextContent("Porque la atrae la Tierra.");
    });
    expect(bodies).toHaveLength(2);
    expect(JSON.stringify(bodies[1])).toContain("¿Por qué cae?");
    expect(
      within(chat())
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "¿En qué te puedo ayudar?",
      "¿Por qué cae?",
      "Porque la atrae la Tierra.",
    ]);
    expect(dockAtomy()).toBe("idle");
  });

  it("keeps reading by closing the chat, with focus back on Atomy's button", async () => {
    answerInTurn([() => failedAnswer("provider")]);
    const user = userEvent.setup();
    await openChat(user);
    await ask(user, "¿Por qué cae?");

    await user.click(
      await within(chat()).findByRole("button", { name: "Seguir leyendo" }),
    );

    expect(
      screen.queryByRole("region", { name: "Chat con Atomy" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: DOCK })).toHaveFocus();
  });

  it("marks an answer cut by its length as incomplete, and stops Atomy", async () => {
    answerInTurn([() => streamedAnswer(["La caja cae porque"], "length")]);
    const user = userEvent.setup();
    await openChat(user);

    await ask(user, "¿Por qué cae?");

    expect(
      await within(conversation()).findByText(
        "Respuesta incompleta: se cortó por su longitud.",
      ),
    ).toBeVisible();
    expect(chat()).toHaveTextContent("La caja cae porque");
    expect(dockAtomy()).toBe("stopped");
  });

  it("says Atomy cannot answer when the answer is blocked, and stops Atomy", async () => {
    answerInTurn([() => streamedAnswer([], "content-filter")]);
    const user = userEvent.setup();
    await openChat(user);

    await ask(user, "¿Por qué cae?");

    expect(
      await within(conversation()).findByText(
        /Atomy no puede responder a esa pregunta/,
      ),
    ).toBeVisible();
    expect(dockAtomy()).toBe("stopped");
  });

  it("announces nothing while the answer arrives", async () => {
    answerThatHangsAfter("La caja cae ");
    const user = userEvent.setup();
    await openChat(user);
    expect(announcement()).toBe("");

    await ask(user, "¿Por qué cae?");
    await vi.waitFor(() => {
      expect(chat()).toHaveTextContent("La caja cae");
    });
    expect(announcement()).toBe("");
  });

  it("announces the whole answer, with its note, once it has ended", async () => {
    answerInTurn([() => streamedAnswer(["La caja ", "cae porque"], "length")]);
    const user = userEvent.setup();
    await openChat(user);

    await ask(user, "¿Por qué cae?");

    await vi.waitFor(() => {
      expect(announcement()).toBe(
        "La caja cae porque Respuesta incompleta: se cortó por su longitud.",
      );
    });
  });

  it("announces a failure with what the reader can do", async () => {
    answerInTurn([() => failedAnswer("rate-limit")]);
    const user = userEvent.setup();
    await openChat(user);

    await ask(user, "¿Por qué cae?");

    await vi.waitFor(() => {
      expect(announcement()).toBe(
        "Límite de uso alcanzado, inténtalo más tarde.",
      );
    });
  });

  it("is used with the keyboard alone, and keeps focus where the reader left it while the answer arrives", async () => {
    answerThatHangsAfter("La caja cae ");
    const user = userEvent.setup();
    render(
      <LessonChat>
        <Lesson />
      </LessonChat>,
    );
    screen.getByRole("button", { name: DOCK }).focus();

    await user.keyboard("{Enter}");
    await user.tab();
    await user.tab();
    const input = screen.getByRole("textbox", { name: "Tu pregunta" });
    expect(input).toHaveFocus();
    await user.keyboard("¿Por qué cae?{Enter}");
    await vi.waitFor(() => {
      expect(chat()).toHaveTextContent("La caja cae");
    });
    expect(input).toHaveFocus();

    await user.tab();
    const stop = within(chat()).getByRole("button", {
      name: "Detener la respuesta",
    });
    expect(stop).toHaveFocus();
    await user.keyboard("{Enter}");
    await vi.waitFor(() => {
      expect(dockAtomy()).toBe("idle");
    });
    expect(
      within(chat()).getByRole("button", { name: "Enviar" }),
    ).toHaveFocus();

    await user.keyboard("{Shift>}{Tab}{Tab}{/Shift}");
    expect(
      within(chat()).getByRole("button", { name: "Cerrar el chat" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(
      screen.queryByRole("region", { name: "Chat con Atomy" }),
    ).not.toBeInTheDocument();
  });
});

/** The route handler's answer: a call to a tool of the page, for it to run. */
function toolCallAnswer(toolName: string, input: unknown, id = "c1"): Response {
  return new Response(
    uiStream([
      { type: "start" },
      { type: "start-step" },
      { type: "tool-input-available", toolCallId: id, toolName, input },
      { type: "finish-step" },
      {
        type: "finish",
        finishReason: "tool-calls",
        messageMetadata: { finishReason: "tool-calls" },
      },
    ]),
    { headers: STREAM_HEADERS },
  );
}

/** Stubs the route handler with these answers in turn, the last one repeated. */
function answerInTurn(answers: (() => Response)[]): { bodies: unknown[] } {
  const bodies: unknown[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
    bodies.push(requestBody(init));
    const answer = answers[Math.min(bodies.length, answers.length) - 1];
    if (!answer) throw new Error("No answer");
    return Promise.resolve(answer());
  });
  return { bodies };
}

const SECOND_SECTION_TITLE = "Lo que tira de cada caja";

/** Two sections of the lesson; the second one may not be shown yet. */
function renderTwoSections(second = true) {
  render(
    <LessonControllerProvider>
      <LessonChat>
        <Lesson />
        {second && (
          <section id="iguales" aria-labelledby="iguales-titulo">
            <h2 id="iguales-titulo">{SECOND_SECTION_TITLE}</h2>
          </section>
        )}
      </LessonChat>
    </LessonControllerProvider>,
  );
}

/** The polite live region where the chat announces what Atomy did. */
function actionAnnouncement(): string {
  return screen.getByRole("status", { name: "Lo que hace Atomy" }).textContent;
}

// Only the fields the tests read; the rest of each message passes through.
const SentMessages = z.looseObject({
  messages: z.array(
    z.looseObject({
      role: z.string(),
      parts: z.array(
        z.looseObject({
          type: z.string(),
          state: z.string().optional(),
          output: z.unknown().optional(),
          errorText: z.string().optional(),
        }),
      ),
    }),
  ),
});

function sentMessages(body: unknown): z.infer<typeof SentMessages>["messages"] {
  return SentMessages.parse(body).messages;
}

function lastSentMessage(
  body: unknown,
): z.infer<typeof SentMessages>["messages"][number] | undefined {
  return sentMessages(body).at(-1);
}

describe("LessonChat, when Atomy operates the lesson,", () => {
  const GO = { section: "iguales" };

  it("takes the reader to a section, with focus on its title", async () => {
    answerInTurn([
      () => toolCallAnswer("go_to_section", GO),
      () => streamedAnswer(["Aquí lo tienes."]),
    ]);
    const user = userEvent.setup();
    renderTwoSections();
    await user.click(screen.getByRole("button", { name: DOCK }));

    await ask(user, "¿Dónde están los patinadores?");

    await vi.waitFor(() => {
      expect(conversation()).toHaveTextContent("Aquí lo tienes.");
    });
    expect(
      screen.getByRole("heading", { name: SECOND_SECTION_TITLE }),
    ).toHaveFocus();
    const line = `Atomy te llevó a la sección «${SECOND_SECTION_TITLE}».`;
    expect(conversation()).toHaveTextContent(line);
    expect(actionAnnouncement()).toBe(line);
  });

  it("sends the page's result back to the model", async () => {
    const { bodies } = answerInTurn([
      () => toolCallAnswer("go_to_section", GO),
      () => streamedAnswer(["Aquí lo tienes."]),
    ]);
    const user = userEvent.setup();
    renderTwoSections();
    await user.click(screen.getByRole("button", { name: DOCK }));

    await ask(user, "¿Dónde están los patinadores?");

    await vi.waitFor(() => {
      expect(bodies).toHaveLength(2);
    });
    expect(lastSentMessage(bodies[1])?.parts).toContainEqual(
      expect.objectContaining({
        type: "tool-go_to_section",
        state: "output-available",
        output: { section: "iguales", title: SECOND_SECTION_TITLE },
      }),
    );
  });

  it("sends the model the error when the section is not shown yet, and writes no action", async () => {
    const { bodies } = answerInTurn([
      () => toolCallAnswer("go_to_section", GO),
      () => streamedAnswer(["Aún no has llegado ahí."]),
    ]);
    const user = userEvent.setup();
    renderTwoSections(false);
    await user.click(screen.getByRole("button", { name: DOCK }));

    await ask(user, "¿Dónde están los patinadores?");

    await vi.waitFor(() => {
      expect(conversation()).toHaveTextContent("Aún no has llegado ahí.");
    });
    const sent = lastSentMessage(bodies[1])?.parts.find(
      (part) => part.type === "tool-go_to_section",
    );
    expect(sent?.state).toBe("output-error");
    expect(sent?.errorText).toMatch(/iguales/);
    expect(conversation()).not.toHaveTextContent("Atomy te llevó");
    expect(actionAnnouncement()).toBe("");
  });

  it("stops resending by itself after a fixed number of rounds of tools in one question", async () => {
    let call = 0;
    const { bodies } = answerInTurn([
      () => {
        call += 1;
        return toolCallAnswer("go_to_section", GO, `c${String(call)}`);
      },
    ]);
    const user = userEvent.setup();
    renderTwoSections();
    await user.click(screen.getByRole("button", { name: DOCK }));

    await ask(user, "Llévame a los patinadores");

    await vi.waitFor(() => {
      expect(dockAtomy()).toBe("idle");
      expect(bodies).toHaveLength(1 + MAX_AUTOMATIC_RESENDS);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(bodies).toHaveLength(1 + MAX_AUTOMATIC_RESENDS);

    await ask(user, "Otra vez");

    await vi.waitFor(() => {
      expect(bodies).toHaveLength(2 * (1 + MAX_AUTOMATIC_RESENDS));
    });
  });
});

describe("LessonChat, when Atomy operates the section's widgets,", () => {
  const TABLE_TITLE = "¿Por qué no notas que te atrae la mesa?";

  /** The lesson's first section and, last and so visible in jsdom, «mesa». */
  function renderTableSection() {
    render(
      <LessonControllerProvider>
        <LessonChat>
          <Lesson />
          <section id="mesa" aria-labelledby="mesa-titulo">
            <h2 id="mesa-titulo">{TABLE_TITLE}</h2>
            <LessonSection id="mesa">
              <Astronauts />
            </LessonSection>
          </section>
        </LessonChat>
      </LessonControllerProvider>,
    );
  }

  it("sets a widget of the section, says so, highlights it and announces it", async () => {
    answerInTurn([
      () =>
        toolCallAnswer("set_widget", { widget: "astronautas", speed: "×600" }),
      () => streamedAnswer(["Mira el reloj."]),
    ]);
    const user = userEvent.setup();
    renderTableSection();
    await user.click(screen.getByRole("button", { name: DOCK }));

    await ask(user, "Acelera el tiempo");

    await vi.waitFor(() => {
      expect(conversation()).toHaveTextContent("Mira el reloj.");
    });
    expect(screen.getByRole("button", { name: "×600" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const line = "Atomy puso los dos astronautas con el tiempo a ×600.";
    expect(conversation()).toHaveTextContent(line);
    expect(actionAnnouncement()).toBe(line);
    expect(document.querySelector("#mesa [data-highlighted]")).not.toBeNull();
  });

  it("sends the section's widgets with each request", async () => {
    const { bodies } = answerInTurn([
      () =>
        toolCallAnswer("set_widget", { widget: "astronautas", speed: "×600" }),
      () => streamedAnswer(["Mira el reloj."]),
    ]);
    const user = userEvent.setup();
    renderTableSection();
    await user.click(screen.getByRole("button", { name: DOCK }));

    await ask(user, "Acelera el tiempo");

    await vi.waitFor(() => {
      expect(bodies).toHaveLength(2);
    });
    expect(bodies[0]).toMatchObject({
      snapshot: { widgets: [{ widget: "astronautas", speed: "×1" }] },
    });
    expect(bodies[1]).toMatchObject({
      snapshot: { widgets: [{ widget: "astronautas", speed: "×600" }] },
    });
  });

  it("leaves a widget as it was and sends the model the error for a state outside its schema", async () => {
    const { bodies } = answerInTurn([
      () =>
        toolCallAnswer("set_widget", { widget: "astronautas", speed: "×2" }),
      () => streamedAnswer(["Esa velocidad no está."]),
    ]);
    const user = userEvent.setup();
    renderTableSection();
    await user.click(screen.getByRole("button", { name: DOCK }));

    await ask(user, "Pon el tiempo a ×2");

    await vi.waitFor(() => {
      expect(conversation()).toHaveTextContent("Esa velocidad no está.");
    });
    expect(screen.getByRole("button", { name: "×1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const sent = lastSentMessage(bodies[1])?.parts.find(
      (part) => part.type === "tool-set_widget",
    );
    expect(sent?.state).toBe("output-error");
    expect(sent?.errorText).toMatch(/speed/);
    expect(conversation()).not.toHaveTextContent("Atomy puso");
  });
});

describe("LessonChat, in the lesson's progress,", () => {
  const KEY = progressStorageKey("leccion");

  function Kept(): ReactElement {
    return (
      <ProgressProvider store={createProgressStore(KEY)} restoreScroll={false}>
        <LessonChat>
          <Lesson>
            <AskAbout context="la caída" />
          </Lesson>
        </LessonChat>
      </ProgressProvider>
    );
  }

  it("shows the conversation, its experiment and the open panel again after a reload", async () => {
    answerWith(["Porque la Luna atrae menos."]);
    const user = userEvent.setup();
    const { unmount } = render(<Kept />);
    await user.click(
      screen.getByRole("button", { name: "Preguntar sobre la caída" }),
    );
    await ask(user, "¿Por qué tarda más?");
    await vi.waitFor(() => {
      expect(within(chat()).getAllByRole("listitem")).toHaveLength(3);
    });
    unmount();

    render(<Kept />);

    await vi.waitFor(() => {
      expect(chat()).toHaveTextContent("Sobre: la caída");
      expect(
        within(chat())
          .getAllByRole("listitem")
          .map((message) => message.textContent),
      ).toEqual([
        "¿Qué duda tienes sobre este experimento?",
        "¿Por qué tarda más?",
        "Porque la Luna atrae menos.",
      ]);
    });
  });

  it("keeps a new conversation empty after a reload", async () => {
    answerWith(["Porque la Luna atrae menos."]);
    const user = userEvent.setup();
    const { unmount } = render(<Kept />);
    await user.click(
      screen.getByRole("button", { name: "Preguntar sobre la caída" }),
    );
    await ask(user, "¿Por qué tarda más?");
    await vi.waitFor(() => {
      expect(within(chat()).getAllByRole("listitem")).toHaveLength(3);
    });
    await user.click(
      within(chat()).getByRole("button", { name: "Nueva conversación" }),
    );
    unmount();

    // The saved conversation is empty, so the reload restores nothing.
    expect(createProgressStore(KEY).get("chat")).toEqual({ messages: [] });
    render(<Kept />);
    expect(within(chat()).getAllByRole("listitem")).toHaveLength(1);
  });

  it("starts empty from a saved conversation that is not valid", async () => {
    createProgressStore(KEY).set("chat", {
      context: { prediction: "caida", question: "la caída" },
      messages: [{ id: "x", role: "nadie", parts: [] }],
    });
    createProgressStore(KEY).set("chat-abierto", true);

    render(<Kept />);

    await vi.waitFor(() => {
      expect(chat()).not.toHaveTextContent("Sobre:");
    });
    expect(within(chat()).getAllByRole("listitem")).toHaveLength(1);
  });
});
