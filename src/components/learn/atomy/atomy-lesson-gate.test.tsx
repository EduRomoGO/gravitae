import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AtomyBubble } from "@/components/learn/atomy/atomy-bubble";
import {
  ATOMY_INTRO_COOKIE,
  forgetAtomyIntro,
} from "@/components/atomy/atomy-cookie";
import { AtomyLessonGate } from "@/components/learn/atomy/atomy-lesson-gate";
import { AtomyModeProvider } from "@/components/shared/atomy-mode";
import { LessonSection } from "@/components/learn/lesson/lesson-section";
import { Predict } from "@/components/learn/lesson/predict";
import { choices } from "@/components/learn/lesson/responses";
import { Step, Steps } from "@/components/learn/lesson/steps";
import { Tower } from "@/components/learn/experiments/tower";
import { type LessonController } from "@/components/learn/lesson-controller";
import { useLessonController } from "@tests/support/lesson-controller";
import { preferReducedMotion } from "@tests/support/reduced-motion";

const REPLY_MS = 1800;

// jsdom implements neither the Web Animations API nor scrolling.
const animate = vi.fn(() => ({ onfinish: null }));
const scrollIntoView = vi.fn();
const scrollTo = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  Object.assign(Element.prototype, { animate, scrollIntoView });
  vi.spyOn(window, "scrollTo").mockImplementation(scrollTo);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  animate.mockClear();
  scrollIntoView.mockClear();
  scrollTo.mockClear();
  forgetAtomyIntro();
  localStorage.clear();
});

function Gate({
  greeted = false,
  advanced = false,
  modelConfigured = true,
  showAll = false,
}: {
  greeted?: boolean;
  /** The reader prefers the advanced mode. */
  advanced?: boolean;
  modelConfigured?: boolean;
  showAll?: boolean;
}) {
  return (
    <main>
      <AtomyLessonGate
        greeted={greeted}
        serverMode={{ modelConfigured, choice: advanced ? "ia" : "reduced" }}
        showAll={showAll}
      >
        <h1>La lección</h1>
        <AtomyBubble>
          <p>Primera pregunta</p>
        </AtomyBubble>
      </AtomyLessonGate>
    </main>
  );
}

function answer(label = "Sí") {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

function understand() {
  fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
}

function atomyState() {
  return document.querySelector(".atom-svg")?.getAttribute("data-state");
}

describe("AtomyLessonGate", () => {
  it("opens with Atomy presenting itself, without the lesson", () => {
    render(<Gate />);

    expect(
      screen.getByRole("region", { name: "Atomy se presenta" }),
    ).toHaveTextContent("¡Hola! Soy Atomy.");
    expect(screen.getByRole("status")).toHaveTextContent("¿Empezamos?");
    expect(screen.getByRole("button", { name: "Sí" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "¡Claro que sí!" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("La lección")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Aprende la ley de la gravitación universal de Newton",
    );
  });

  it("offers the chat in its presentation only in the advanced mode", () => {
    const { unmount } = render(<Gate />);
    expect(screen.getByRole("status")).not.toHaveTextContent("¡pregúntame!");
    unmount();

    render(<Gate advanced />);
    expect(screen.getByRole("status")).toHaveTextContent("¡pregúntame!");
  });

  it.each(["Sí", "¡Claro que sí!"])(
    "replies to «%s» and opens the lesson once understood, remembering the reader",
    (label) => {
      render(<Gate />);

      answer(label);
      expect(screen.getByRole("status")).toHaveTextContent(
        "¡Te veo en el primer experimento!",
      );
      expect(screen.queryByRole("button", { name: label })).toBeNull();
      expect(screen.queryByText("La lección")).not.toBeInTheDocument();
      expect(document.cookie).not.toContain(ATOMY_INTRO_COOKIE);

      understand();

      expect(screen.getByText("La lección")).toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Atomy se presenta" }),
      ).not.toBeInTheDocument();
      expect(document.cookie).toContain(`${ATOMY_INTRO_COOKIE}=seen`);
    },
  );

  it("waits on its reply, quiet, until the reader understands", () => {
    render(<Gate />);
    answer();
    expect(atomyState()).toBe("talking");
    expect(screen.getByRole("button", { name: "Entendido" })).toHaveFocus();

    act(() => {
      vi.advanceTimersByTime(REPLY_MS * 10);
    });

    expect(atomyState()).toBe("idle");
    expect(screen.getByRole("status")).toHaveTextContent(
      "¡Te veo en el primer experimento!",
    );
    expect(screen.queryByText("La lección")).not.toBeInTheDocument();
    expect(document.cookie).not.toContain(ATOMY_INTRO_COOKIE);
  });

  it("flies Atomy into the first experiment in the reduced mode", () => {
    render(<Gate />);
    answer();

    understand();

    const avatar = document.querySelector("main [data-atomy-avatar]");
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.contexts[0]).toBe(avatar);
  });

  it("flies Atomy to the chat's corner in the advanced mode", () => {
    render(<Gate advanced />);
    answer();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Puedes encontrarme en cada experimento o en la esquina inferior derecha.",
    );

    understand();

    expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.contexts[0]).toBe(
      screen.getByRole("button", { name: "Pregúntale a Atomy" }),
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("does not fly with reduced motion", () => {
    preferReducedMotion();
    render(<Gate />);
    answer();

    understand();

    expect(screen.getByText("La lección")).toBeInTheDocument();
    expect(animate).not.toHaveBeenCalled();
  });

  it("opens the lesson directly for a reader who has met Atomy", () => {
    render(<Gate greeted />);

    expect(screen.getByText("La lección")).toBeInTheDocument();
    expect(screen.getByText("PROTOTIPO · modo reducido")).toBeInTheDocument();
    expect(animate).not.toHaveBeenCalled();
  });

  it("replays the presentation from the lesson", () => {
    render(<Gate greeted />);

    fireEvent.click(
      screen.getByRole("button", { name: "Ver la presentación de Atomy" }),
    );

    expect(
      screen.getByRole("region", { name: "Atomy se presenta" }),
    ).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it("shows the reduced mode without the chat", () => {
    render(<Gate greeted />);

    expect(
      screen.queryByRole("button", { name: "Pregúntale a Atomy" }),
    ).not.toBeInTheDocument();
  });

  it("wraps the lesson in the chat in the advanced mode", () => {
    render(<Gate greeted advanced />);

    expect(screen.getByText("PROTOTIPO · modo con IA")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pregúntale a Atomy" }),
    ).toBeInTheDocument();
  });

  it("links the step-by-step lesson to the whole lesson at once, and back", () => {
    const { unmount } = render(<Gate greeted />);
    expect(
      screen.getByRole("link", { name: "Ver toda la lección de golpe" }),
    ).toHaveAttribute("href", "/ley-gravitacion-universal-newton?todo=");
    unmount();

    render(<Gate greeted showAll />);

    expect(
      screen.getByRole("link", { name: "Volver a la lección paso a paso" }),
    ).toHaveAttribute("href", "/ley-gravitacion-universal-newton");
  });

  describe("without a language model configured", () => {
    it("opens the reduced mode, without the chat, though the reader prefers the advanced one", () => {
      render(<Gate greeted advanced modelConfigured={false} />);

      expect(screen.getByText("PROTOTIPO · modo reducido")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Pregúntale a Atomy" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("La lección")).toBeInTheDocument();
    });

    it("presents Atomy as the reduced mode's guide, without offering the chat", () => {
      render(<Gate advanced modelConfigured={false} />);

      expect(
        screen.getByRole("region", { name: "Atomy se presenta" }),
      ).not.toHaveTextContent("¡pregúntame!");
    });
  });

  describe("with the model out of reach", () => {
    let online = true;

    beforeEach(() => {
      online = true;
      vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json({ status: "available" }),
      );
    });

    function goOffline() {
      online = false;
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });
    }

    it("hides the chat while the browser has no connection, and shows it again when it comes back", async () => {
      render(
        <AtomyModeProvider>
          <Gate greeted advanced />
        </AtomyModeProvider>,
      );
      await act(() => Promise.resolve());
      expect(
        screen.getByRole("button", { name: "Pregúntale a Atomy" }),
      ).toBeInTheDocument();

      goOffline();

      expect(
        screen.queryByRole("button", { name: "Pregúntale a Atomy" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("PROTOTIPO · modo reducido")).toBeInTheDocument();

      online = true;
      await act(() => {
        window.dispatchEvent(new Event("online"));
        return Promise.resolve();
      });

      expect(
        screen.getByRole("button", { name: "Pregúntale a Atomy" }),
      ).toBeInTheDocument();
    });

    it("hides the chat when the server cannot reach the model", async () => {
      vi.mocked(fetch).mockResolvedValue(
        Response.json({ status: "unreachable" }),
      );

      render(
        <AtomyModeProvider>
          <Gate greeted advanced />
        </AtomyModeProvider>,
      );
      await act(() => Promise.resolve());

      expect(
        screen.queryByRole("button", { name: "Pregúntale a Atomy" }),
      ).not.toBeInTheDocument();
    });

    it("keeps the reader's progress when the connection goes", async () => {
      render(
        <AtomyModeProvider>
          <main>
            <AtomyLessonGate
              greeted
              serverMode={{ modelConfigured: true, choice: "ia" }}
            >
              <Steps order={["uno", "dos"]}>
                <Step id="uno">
                  <LessonSection id="distancia">
                    <Predict
                      id="distancia"
                      question="¿Cuánto pesa arriba?"
                      response={choices(["Igual", "Menos"], 1)}
                      explanation={<p>Pesa menos.</p>}
                    >
                      <Tower />
                    </Predict>
                  </LessonSection>
                </Step>
                <Step id="dos">
                  <p>Paso dos</p>
                </Step>
              </Steps>
            </AtomyLessonGate>
          </main>
        </AtomyModeProvider>,
      );
      await act(() => Promise.resolve());
      fireEvent.click(screen.getByRole("button", { name: "Menos" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Hacer el experimento" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

      goOffline();

      expect(screen.getByText("Paso dos")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Menos" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });
});

describe("AtomyLessonGate's lesson controller", () => {
  function Probe({ onReady }: { onReady: (c: LessonController) => void }) {
    onReady(useLessonController());
    return null;
  }

  it.each([false, true])(
    "lets the lesson's widgets be set from outside (advanced: %s)",
    (advanced) => {
      let controller: LessonController | null = null;
      render(
        <AtomyLessonGate
          greeted
          serverMode={{
            modelConfigured: true,
            choice: advanced ? "ia" : "reduced",
          }}
        >
          <Probe
            onReady={(c) => {
              controller = c;
            }}
          />
          <LessonSection id="distancia">
            <Tower />
          </LessonSection>
        </AtomyLessonGate>,
      );

      act(() => {
        controller?.setWidget("ascensor", { distance: 2 });
      });

      expect(
        screen.getByText(/Peso de 1 kg: 9,8 ÷ \(2 × 2\)/),
      ).toBeInTheDocument();
    },
  );
});

describe("AtomyLessonGate's progress", () => {
  function Lesson({
    greeted = true,
    advanced = false,
  }: {
    greeted?: boolean;
    advanced?: boolean;
  }) {
    return (
      <main>
        <AtomyLessonGate
          greeted={greeted}
          serverMode={{
            modelConfigured: true,
            choice: advanced ? "ia" : "reduced",
          }}
        >
          <Steps order={["uno", "dos"]}>
            <Step id="uno">
              <LessonSection id="distancia">
                <Predict
                  id="distancia"
                  question="¿Cuánto pesa arriba?"
                  response={choices(["Igual", "Menos"], 1)}
                  explanation={<p>Pesa menos.</p>}
                >
                  <Tower />
                </Predict>
              </LessonSection>
            </Step>
            <Step id="dos">
              <p>Paso dos</p>
            </Step>
          </Steps>
        </AtomyLessonGate>
      </main>
    );
  }

  function predictAndCheck() {
    fireEvent.click(screen.getByRole("button", { name: "Menos" }));
    // The advanced mode keeps the experiment until the reader opens it.
    const open = screen.queryByRole("button", { name: "Hacer el experimento" });
    if (open) fireEvent.click(open);
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
  }

  it("goes on where the reader was after a reload", () => {
    const { unmount } = render(<Lesson />);
    predictAndCheck();
    expect(screen.getByText("Paso dos")).toBeInTheDocument();
    unmount();

    render(<Lesson />);

    expect(screen.getByRole("button", { name: "Menos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("¡Has acertado!")).toBeInTheDocument();
    expect(screen.getByText("Paso dos")).toBeInTheDocument();
  });

  it("sets each widget back as the reader left it", () => {
    let controller: LessonController | null = null;
    function Probe({ onReady }: { onReady: (c: LessonController) => void }) {
      onReady(useLessonController());
      return null;
    }
    const lesson = (
      <AtomyLessonGate
        greeted
        serverMode={{ modelConfigured: true, choice: "reduced" }}
      >
        <Probe
          onReady={(c) => {
            controller = c;
          }}
        />
        <LessonSection id="distancia">
          <Tower />
        </LessonSection>
      </AtomyLessonGate>
    );
    const { unmount } = render(lesson);
    act(() => {
      controller?.setWidget("ascensor", { distance: 2 });
    });
    unmount();

    render(lesson);

    expect(
      screen.getByText(/Peso de 1 kg: 9,8 ÷ \(2 × 2\)/),
    ).toBeInTheDocument();
  });

  it("shares one progress between both modes", () => {
    const { unmount } = render(<Lesson />);
    predictAndCheck();
    unmount();

    render(<Lesson advanced />);

    expect(screen.getByText("Paso dos")).toBeInTheDocument();
  });

  it("keeps the progress when the presentation is watched again", () => {
    render(<Lesson />);
    predictAndCheck();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver la presentación de Atomy" }),
    );
    answer();
    understand();

    expect(screen.getByText("Paso dos")).toBeInTheDocument();
  });

  it("asks before starting over, and the reader can cancel", () => {
    render(<Lesson />);
    predictAndCheck();

    fireEvent.click(screen.getByRole("button", { name: "Empezar de nuevo" }));

    const cancel = screen.getByRole("button", { name: "Cancelar" });
    expect(cancel).toHaveFocus();
    expect(
      screen.getByRole("group", {
        description: "Se borrarán tus respuestas. ¿Empezar de nuevo?",
      }),
    ).toBeInTheDocument();
    fireEvent.click(cancel);
    expect(
      screen.getByRole("button", { name: "Empezar de nuevo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Paso dos")).toBeInTheDocument();
  });

  it("starts over from the presentation, forgetting the progress and the entries per mode of older versions", () => {
    localStorage.setItem(
      "gravitae:progreso:ley-gravitacion-universal-newton:ia",
      "{}",
    );
    render(<Lesson />);
    predictAndCheck();
    document.cookie = `${ATOMY_INTRO_COOKIE}=seen; path=/`;

    fireEvent.click(screen.getByRole("button", { name: "Empezar de nuevo" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Sí, empezar de nuevo" }),
    );

    expect(
      screen.getByRole("region", { name: "Atomy se presenta" }),
    ).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(document.cookie).not.toContain(ATOMY_INTRO_COOKIE);
    expect(localStorage).toHaveLength(0);
    answer();
    understand();
    expect(screen.getByRole("button", { name: "Menos" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByText("Paso dos")).not.toBeInTheDocument();
  });
});
