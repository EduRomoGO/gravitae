import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { loadLessonChatPanel } from "@tests/support/lesson-chat-panel";
import { LessonChat } from "@/components/learn/atomy/lesson-chat";
import { FALLBACK_NOTE } from "@/components/atomy/fallback-note";
import { AtomyModeProvider, STATUS_URL } from "@/components/shared/atomy-mode";
import { LessonControllerProvider } from "@/components/learn/lesson-controller";
import { LessonSection } from "@/components/learn/lesson/lesson-section";
import { LessonModeProvider } from "@/components/learn/lesson/lesson-mode";
import { ProgressProvider } from "@/components/shared/progress";
import { Predict } from "@/components/learn/lesson/predict";
import { choices } from "@/components/learn/lesson/responses";
import { Step, Steps } from "@/components/learn/lesson/steps";
import { createProgressStore } from "@/lib/progress/progress-store";
import {
  MAX_REASONING_CHARS,
  correctionRequestSchema,
} from "@/lib/atomy/correction-request";

beforeAll(loadLessonChatPanel);

const QUESTION =
  "Doblas la masa de A y también la de B. ¿Qué le pasa a la fuerza?";
const FIELD = "¿Por qué lo crees? (opcional)";
const SEND = "Enviar a Atomy";
const REASONING = "Porque la fuerza va con la suma de las dos masas.";
const EXPERIMENT = "Hacer el experimento";
const SEE_ANYWAY = "Ver el experimento igualmente";
const FEEDBACK =
  "¿Cuántos hilos ves al doblar las dos masas? Cuéntalos en el experimento.";

function Question(): ReactElement {
  return (
    <section id="cualquiera" aria-labelledby="cualquiera-titulo">
      <h2 id="cualquiera-titulo">¿Esto vale solo para planetas?</h2>
      <p>La atracción vale para dos objetos cualesquiera.</p>
      <LessonSection id="cualquiera">
        <Predict
          id="cualquiera"
          question={QUESTION}
          response={choices(["×2", "×4", "×1, se queda igual"], 1)}
          explanation={<p>Hay 2 × 2 = 4 veces más hilos.</p>}
        >
          <p>El experimento</p>
        </Predict>
      </LessonSection>
    </section>
  );
}

function advanced(): void {
  render(
    <LessonControllerProvider>
      <LessonChat>
        <Question />
      </LessonChat>
    </LessonControllerProvider>,
  );
}

const PROGRESS_KEY = "gravitae:progreso:prueba:ia";

/** The advanced mode inside steps, with the progress saved in localStorage. */
function advancedInSteps() {
  return render(
    <ProgressProvider
      store={createProgressStore(PROGRESS_KEY)}
      restoreScroll={false}
    >
      <LessonControllerProvider>
        <LessonChat>
          <Steps order={["uno", "dos"]}>
            <Step id="uno">
              <Question />
            </Step>
            <Step id="dos">
              <p>Siguiente paso</p>
            </Step>
          </Steps>
        </LessonChat>
      </LessonControllerProvider>
    </ProgressProvider>,
  );
}

function answerWith(status: number, body: unknown) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() => Promise.resolve(Response.json(body, { status })));
}

function bodyOf(init: RequestInit | undefined): string {
  return typeof init?.body === "string" ? init.body : "";
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

async function sendReasoning(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "×2" }));
  await user.type(screen.getByRole("textbox", { name: FIELD }), REASONING);
  await user.click(screen.getByRole("button", { name: SEND }));
}

describe("the reasoning's correction in a prediction", () => {
  it("does not ask for the reasoning outside the advanced mode", async () => {
    const user = userEvent.setup();
    render(<Question />);

    await user.click(screen.getByRole("button", { name: "×2" }));

    expect(
      screen.queryByRole("textbox", { name: FIELD }),
    ).not.toBeInTheDocument();
  });

  it("reads the advanced mode from the lesson, whether or not a chat opens", () => {
    render(
      <LessonModeProvider mode="ia">
        <Question />
      </LessonModeProvider>,
    );

    expect(screen.getByRole("textbox", { name: FIELD })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Pregúntale a Atomy sobre este experimento",
      }),
    ).not.toBeInTheDocument();
  });

  it("asks for the reasoning with the question, with its limit in sight", async () => {
    const user = userEvent.setup();
    advanced();

    const field = screen.getByRole("textbox", { name: FIELD });
    expect(field).toHaveAttribute("maxlength", String(MAX_REASONING_CHARS));
    expect(field).toHaveAccessibleDescription(
      `0 de ${String(MAX_REASONING_CHARS)} caracteres`,
    );
    await user.type(field, REASONING);
    // Without an answer there is nothing to correct.
    expect(screen.getByRole("button", { name: SEND })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "×2" }));
    expect(screen.getByRole("button", { name: SEND })).toBeEnabled();
  });

  it("lets the reader skip the reasoning: the prediction corrects the option as before", async () => {
    const fetchMock = answerWith(200, {});
    const user = userEvent.setup();
    advanced();

    await user.click(screen.getByRole("button", { name: "×2" }));
    await user.click(screen.getByRole("button", { name: EXPERIMENT }));
    await user.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(
      screen.getByText(
        "Has elegido «×2», pero la respuesta correcta es «×4».",
        {
          exact: false,
        },
      ),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the section, the prediction and the reasoning to the correction", async () => {
    const fetchMock = answerWith(200, {
      verdict: "incorrect",
      misconception: "masas-se-suman",
      feedback: FEEDBACK,
    });
    const user = userEvent.setup();
    advanced();

    await sendReasoning(user);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/atomy/correction");
    const sent = correctionRequestSchema.parse(JSON.parse(bodyOf(init)));
    expect(sent.section.text).toBe(
      "¿Esto vale solo para planetas? La atracción vale para dos objetos cualesquiera. ¿Tú qué crees? Doblas la masa de A y también la de B. ¿Qué le pasa a la fuerza? ×2 ×4 ×1, se queda igual",
    );
    expect({ ...sent, section: { ...sent.section, text: "" } }).toEqual({
      section: {
        id: "cualquiera",
        title: "¿Esto vale solo para planetas?",
        text: "",
      },
      prediction: {
        id: "cualquiera",
        question: QUESTION,
        chosen: "×2",
        answer: "×4",
        revealed: false,
      },
      reasoning: REASONING,
    });
  });

  it("shows Atomy's explanation, and the verdict only once the reader checks the answer", async () => {
    answerWith(200, {
      verdict: "incorrect",
      misconception: "masas-se-suman",
      feedback: FEEDBACK,
    });
    const user = userEvent.setup();
    advanced();

    await sendReasoning(user);

    const correction = await screen.findByRole("region", {
      name: `Corrección de tu razonamiento: ${QUESTION}`,
    });
    expect(correction).toHaveTextContent(FEEDBACK);
    expect(correction).not.toHaveTextContent("idea equivocada");
    expect(correction).not.toHaveTextContent("las masas se suman");

    await user.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(correction).toHaveTextContent(
      "Tu razonamiento se apoya en una idea equivocada",
    );
    expect(correction).toHaveTextContent("Idea a revisar: las masas se suman");
  });

  it("warns that the correction may be worse when a fallback model wrote it", async () => {
    answerWith(200, {
      verdict: "incorrect",
      misconception: "masas-se-suman",
      feedback: FEEDBACK,
      fallback: true,
    });
    const user = userEvent.setup();
    advanced();

    await sendReasoning(user);

    const correction = await screen.findByRole("region", {
      name: `Corrección de tu razonamiento: ${QUESTION}`,
    });
    expect(correction).toHaveTextContent(FEEDBACK);
    expect(correction).toHaveTextContent(FALLBACK_NOTE);
  });

  it("gives no warning when the main model wrote the correction", async () => {
    answerWith(200, {
      verdict: "incorrect",
      misconception: "masas-se-suman",
      feedback: FEEDBACK,
    });
    const user = userEvent.setup();
    advanced();

    await sendReasoning(user);

    const correction = await screen.findByRole("region", {
      name: `Corrección de tu razonamiento: ${QUESTION}`,
    });
    expect(correction).toHaveTextContent(FEEDBACK);
    expect(correction).not.toHaveTextContent(FALLBACK_NOTE);
  });

  it("shows the verdict at once when the answer is already checked", async () => {
    const fetchMock = answerWith(200, {
      verdict: "partial",
      misconception: null,
      feedback: "Vas bien, pero cuenta los hilos.",
    });
    const user = userEvent.setup();
    advanced();

    await user.click(screen.getByRole("button", { name: "×4" }));
    await user.click(screen.getByRole("button", { name: EXPERIMENT }));
    await user.click(screen.getByRole("button", { name: "Comprobar" }));
    await user.type(screen.getByRole("textbox", { name: FIELD }), REASONING);
    await user.click(screen.getByRole("button", { name: SEND }));

    const correction = await screen.findByRole("region", {
      name: `Corrección de tu razonamiento: ${QUESTION}`,
    });
    expect(correction).toHaveTextContent(
      "Tu razonamiento es correcto en parte",
    );
    expect(bodyOf(fetchMock.mock.calls[0]?.[1])).toContain('"revealed":true');
  });

  describe("shows a controlled message and keeps the prediction's own correction", () => {
    const cases: [string, number, string][] = [
      [
        "invalid-output",
        502,
        "Atomy no ha podido corregir tu razonamiento esta vez.",
      ],
      ["rate-limit", 429, "Atomy ha llegado a su límite de uso"],
      ["provider", 502, "Atomy no responde ahora mismo"],
      ["an unknown code", 500, "Atomy no responde ahora mismo"],
    ];

    it.each(cases)("%s", async (code, status, message) => {
      answerWith(status, {
        error: code === "an unknown code" ? "teapot" : code,
      });
      const user = userEvent.setup();
      advanced();

      await sendReasoning(user);

      const correction = await screen.findByRole("region", {
        name: `Corrección de tu razonamiento: ${QUESTION}`,
      });
      expect(correction).toHaveTextContent(message);
      await user.click(screen.getByRole("button", { name: "Comprobar" }));
      expect(
        screen.getByText(
          "Has elegido «×2», pero la respuesta correcta es «×4».",
          { exact: false },
        ),
      ).toBeInTheDocument();
    });
  });

  it.each([
    ["provider", 502, true],
    ["rate-limit", 429, false],
  ] as const)(
    "after a %s failure, asks again whether the model can be reached: %s",
    async (code, status, rechecks) => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation((url) =>
          Promise.resolve(
            typeof url === "string" && url.startsWith(STATUS_URL)
              ? Response.json({ status: "available" })
              : Response.json({ error: code }, { status }),
          ),
        );
      const user = userEvent.setup();
      render(
        <AtomyModeProvider>
          <LessonControllerProvider>
            <LessonChat>
              <Question />
            </LessonChat>
          </LessonControllerProvider>
        </AtomyModeProvider>,
      );

      await sendReasoning(user);
      await screen.findByRole("region", {
        name: `Corrección de tu razonamiento: ${QUESTION}`,
      });

      expect(
        fetchMock.mock.calls.some(([url]) => url === `${STATUS_URL}?fresh`),
      ).toBe(rechecks);
    },
  );

  it("lets the reader retry after a failure", async () => {
    const fetchMock = answerWith(502, { error: "provider" });
    const user = userEvent.setup();
    advanced();
    await sendReasoning(user);
    const correction = await screen.findByRole("region", {
      name: `Corrección de tu razonamiento: ${QUESTION}`,
    });
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        Response.json({
          verdict: "incorrect",
          misconception: "masas-se-suman",
          feedback: FEEDBACK,
        }),
      ),
    );

    await user.click(
      within(correction).getByRole("button", { name: "Reintentar" }),
    );

    expect(await within(correction).findByText(FEEDBACK)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("the experiment waits for the reasoning in the advanced mode", () => {
  function correctionRegion() {
    return screen.getByRole("region", {
      name: `Corrección de tu razonamiento: ${QUESTION}`,
    });
  }

  async function sendRight(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "×4" }));
    await user.type(screen.getByRole("textbox", { name: FIELD }), REASONING);
    await user.click(screen.getByRole("button", { name: SEND }));
  }

  it("shows the options, the field and both buttons, and keeps the experiment hidden", async () => {
    const user = userEvent.setup();
    advanced();

    expect(screen.getByRole("textbox", { name: FIELD })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: EXPERIMENT })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "×2" }));

    expect(screen.queryByText("El experimento")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Comprobar" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: EXPERIMENT }));
    expect(screen.getByText("El experimento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comprobar" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: EXPERIMENT }),
    ).not.toBeInTheDocument();
  });

  it("skips the experiment when Atomy finds the reasoning correct, and keeps it one click away", async () => {
    answerWith(200, {
      verdict: "correct",
      misconception: null,
      feedback: "Lo has clavado: 2 × 2 = 4 hilos.",
    });
    const user = userEvent.setup();
    advancedInSteps();

    await sendRight(user);

    expect(await screen.findByText("Siguiente paso")).toBeInTheDocument();
    expect(correctionRegion()).toHaveTextContent(
      "¡Genial!Lo has clavado: 2 × 2 = 4 hilos.",
    );
    const verdict = screen.getAllByRole("status").at(-1);
    expect(verdict).toHaveTextContent("Hay 2 × 2 = 4 veces más hilos.");
    expect(verdict).not.toHaveTextContent("¡Has acertado!");
    expect(screen.queryByText("El experimento")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Comprobar" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "×2" })).toBeDisabled();

    const seeAnyway = screen.getByRole("button", { name: SEE_ANYWAY });
    expect(seeAnyway).toHaveAttribute("aria-expanded", "false");
    await user.click(seeAnyway);
    expect(seeAnyway).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("El experimento")).toBeInTheDocument();
  });

  it.each(["partial", "incorrect"])(
    "shows the experiment and «Comprobar» after a %s verdict, without the verdict",
    async (verdict) => {
      answerWith(200, {
        verdict,
        misconception: verdict === "incorrect" ? "masas-se-suman" : null,
        feedback: FEEDBACK,
      });
      const user = userEvent.setup();
      advancedInSteps();

      await sendReasoning(user);

      expect(await screen.findByText("El experimento")).toBeInTheDocument();
      expect(correctionRegion()).toHaveTextContent(FEEDBACK);
      expect(correctionRegion()).not.toHaveTextContent("Tu razonamiento");
      expect(screen.getByRole("button", { name: "Comprobar" })).toBeEnabled();
      expect(screen.queryByText("Siguiente paso")).not.toBeInTheDocument();
    },
  );

  it("shows the experiment when the correction fails", async () => {
    answerWith(502, { error: "provider" });
    const user = userEvent.setup();
    advanced();

    await sendReasoning(user);

    expect(await screen.findByText("El experimento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comprobar" })).toBeEnabled();
  });

  it("skips nothing when the correction is asked for with the experiment open", async () => {
    answerWith(200, {
      verdict: "correct",
      misconception: null,
      feedback: "Lo has clavado: 2 × 2 = 4 hilos.",
    });
    const user = userEvent.setup();
    advancedInSteps();
    await user.click(screen.getByRole("button", { name: "×4" }));
    await user.click(screen.getByRole("button", { name: EXPERIMENT }));

    await user.type(screen.getByRole("textbox", { name: FIELD }), REASONING);
    await user.click(screen.getByRole("button", { name: SEND }));

    expect(
      await within(correctionRegion()).findByText(
        "Lo has clavado: 2 × 2 = 4 hilos.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comprobar" })).toBeEnabled();
    expect(screen.queryByText("Siguiente paso")).not.toBeInTheDocument();
  });

  it("locks the answer and the experiment while Atomy corrects", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>(() => undefined),
    );
    const user = userEvent.setup();
    advanced();

    await sendReasoning(user);

    expect(
      within(correctionRegion()).getByText(
        "Atomy está leyendo tu razonamiento…",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "×4" })).toBeDisabled();
    expect(screen.getByRole("button", { name: EXPERIMENT })).toBeDisabled();
  });

  it("restores a skipped prediction after a reload", async () => {
    answerWith(200, {
      verdict: "correct",
      misconception: null,
      feedback: "Lo has clavado: 2 × 2 = 4 hilos.",
    });
    const user = userEvent.setup();
    const { unmount } = advancedInSteps();
    await sendRight(user);
    await screen.findByText("Siguiente paso");
    unmount();

    advancedInSteps();

    expect(screen.getByText("Siguiente paso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SEE_ANYWAY })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("El experimento")).not.toBeInTheDocument();
    expect(correctionRegion()).toHaveTextContent("¡Genial!");
  });

  it("keeps the answer, the reasoning and the correction under the prediction's id and the answer's key", async () => {
    answerWith(200, {
      verdict: "partial",
      misconception: null,
      feedback: FEEDBACK,
    });
    const user = userEvent.setup();
    advancedInSteps();
    await sendRight(user);
    await vi.waitFor(() => {
      expect(correctionRegion()).toHaveTextContent(FEEDBACK);
    });

    const saved: unknown = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "");
    expect(saved).toMatchObject({
      "prediccion:cualquiera": { chosen: "1" },
      "razonamiento:cualquiera": REASONING,
      "correccion:cualquiera": { kind: "corrected", chosen: "1" },
    });
  });

  it("restores a prediction saved as revealed by a correction, with the experiment one click away", () => {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        "prediccion:cualquiera": {
          phase: "revealed",
          chosen: "1",
          via: "correction",
        },
      }),
    );

    advancedInSteps();

    expect(screen.getByRole("button", { name: "×4" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: SEE_ANYWAY })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("El experimento")).not.toBeInTheDocument();
  });

  it("forgets a saved prediction revealed without an answer", () => {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        "prediccion:cualquiera": { phase: "revealed", via: "correction" },
      }),
    );

    advancedInSteps();

    expect(
      screen.queryByRole("button", { name: SEE_ANYWAY }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Siguiente paso")).not.toBeInTheDocument();
  });

  it("forgets a saved prediction whose answer the options no longer have", () => {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        "prediccion:cualquiera": {
          phase: "revealed",
          chosen: "×2",
          via: "experiment",
        },
      }),
    );

    advancedInSteps();

    for (const option of ["×2", "×4", "×1, se queda igual"]) {
      expect(screen.getByRole("button", { name: option })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
    expect(screen.queryByText(/Has elegido/)).not.toBeInTheDocument();
    expect(screen.queryByText("Siguiente paso")).not.toBeInTheDocument();
  });
});

describe("the predictions in the chat's snapshot", () => {
  /** The bodies the chat sent; the correction answers `verdict`. */
  function answerBoth(verdict: string): unknown[] {
    const chatBodies: unknown[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => {
      if (url === "/api/atomy/correction")
        return Promise.resolve(
          Response.json({ verdict, misconception: null, feedback: FEEDBACK }),
        );
      chatBodies.push(JSON.parse(bodyOf(init)));
      const chunks = [
        { type: "start" },
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: "¿Qué crees tú?" },
        { type: "text-end", id: "t1" },
        { type: "finish", finishReason: "stop" },
      ];
      return Promise.resolve(
        new Response(
          chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
            "data: [DONE]\n\n",
          {
            headers: {
              "content-type": "text/event-stream",
              "x-vercel-ai-ui-message-stream": "v1",
            },
          },
        ),
      );
    });
    return chatBodies;
  }

  async function ask(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      screen.getByRole("button", { name: "Pregúntale a Atomy" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Tu pregunta" }),
      "¿Cuál es?",
    );
    await user.click(screen.getByRole("button", { name: "Enviar" }));
  }

  it("carries none before the reader picks an option", async () => {
    const bodies = answerBoth("partial");
    const user = userEvent.setup();
    advanced();

    await ask(user);

    await vi.waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({ snapshot: { predictions: [] } });
  });

  it("carries the option the reader picked, still unrevealed", async () => {
    const bodies = answerBoth("partial");
    const user = userEvent.setup();
    advanced();
    await user.click(screen.getByRole("button", { name: "×2" }));

    await ask(user);

    await vi.waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({
      snapshot: {
        predictions: [
          {
            id: "cualquiera",
            question: QUESTION,
            chosen: "×2",
            revealed: false,
          },
        ],
      },
    });
  });

  it("carries the correction's verdict and whether the reader checked the answer", async () => {
    const bodies = answerBoth("incorrect");
    const user = userEvent.setup();
    advanced();
    await sendReasoning(user);
    await screen.findByText(FEEDBACK);
    await user.click(screen.getByRole("button", { name: "Comprobar" }));

    await ask(user);

    await vi.waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({
      snapshot: {
        predictions: [
          {
            id: "cualquiera",
            chosen: "×2",
            revealed: true,
            verdict: "incorrect",
          },
        ],
      },
    });
  });
});
