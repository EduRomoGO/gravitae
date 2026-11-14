import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Astronauts } from "@/components/learn/experiments/astronauts";
import { GrowingSphere } from "@/components/learn/experiments/growing-sphere";
import { MassThreads } from "@/components/learn/experiments/mass-threads";
import { Skaters } from "@/components/learn/experiments/skaters";
import { SpringScale } from "@/components/learn/experiments/spring-scale";
import { Tower } from "@/components/learn/experiments/tower";
import { LessonSection } from "@/components/learn/lesson/lesson-section";
import { ProgressProvider } from "@/components/shared/progress";
import type { SectionId } from "@/lib/lesson/sections";
import type { WidgetId } from "@/lib/lesson/widgets";
import {
  LessonControllerProvider,
  type LessonController,
  type SetResult,
} from "@/components/learn/lesson-controller";
import { useLessonController } from "@tests/support/lesson-controller";
import {
  createProgressStore,
  progressStorageKey,
} from "@/lib/progress/progress-store";

// Each widget of the lesson Atomy can set, as the chat's tools reach it:
// through the lesson controller, inside its section, never through the DOM.

const PROGRESS_KEY = progressStorageKey("leccion");

afterEach(() => {
  localStorage.clear();
});

/** The tree of a lesson whose progress is saved under PROGRESS_KEY. */
function withProgress(node: ReactNode): ReactElement {
  return (
    <ProgressProvider
      store={createProgressStore(PROGRESS_KEY)}
      restoreScroll={false}
    >
      {node}
    </ProgressProvider>
  );
}

function renderInSection(
  section: SectionId,
  widget: ReactNode,
  wrap: (node: ReactNode) => ReactElement = (node) => <>{node}</>,
): {
  controller: () => LessonController;
  container: HTMLElement;
  unmount: () => void;
} {
  let controller: LessonController | null = null;
  function Probe(): ReactElement | null {
    controller = useLessonController();
    return null;
  }
  const { container, unmount } = render(
    wrap(
      <LessonControllerProvider>
        <Probe />
        <LessonSection id={section}>{widget}</LessonSection>
      </LessonControllerProvider>,
    ),
  );
  return {
    container,
    unmount,
    controller: () => {
      if (controller === null) throw new Error("No controller");
      return controller;
    },
  };
}

function set(controller: LessonController, id: WidgetId, next: unknown) {
  let result: SetResult<unknown> | undefined;
  act(() => {
    result = controller.setWidget(id, next);
  });
  return result;
}

interface Case {
  readonly id: WidgetId;
  readonly section: SectionId;
  readonly widget: ReactElement;
  readonly initial: object;
  readonly next: object;
  /** What the reader sees once `next` is set. */
  readonly shows: string;
  readonly outside: object;
  readonly error: string;
  /** The reader's own move after Atomy's, and what it shows. */
  readonly readerMove: () => void;
  readonly readerShows: string;
}

const click = (name: string) => () => {
  fireEvent.click(screen.getByRole("button", { name }));
};

const CASES: readonly Case[] = [
  {
    id: "dinamometro",
    section: "tiron",
    widget: <SpringScale />,
    initial: { planet: "Tierra" },
    next: { planet: "Luna" },
    shows: "peso: 1,6 N",
    outside: { planet: "Marte" },
    error: "planet",
    readerMove: click("Llevar el dinamómetro a Júpiter, g = 24,79 m/s²"),
    readerShows: "peso: 24,8 N",
  },
  {
    id: "ascensor",
    section: "distancia",
    widget: <Tower />,
    initial: { distance: 1 },
    next: { distance: 2 },
    shows: "Peso de 1 kg: 9,8 ÷ (2 × 2)",
    outside: { distance: 4 },
    error: "distance must be a whole number from 1 to 3",
    readerMove: click("Llevar el ascensor a ×3"),
    readerShows: "Peso de 1 kg: 9,8 ÷ (3 × 3)",
  },
  {
    id: "esfera",
    section: "distancia",
    widget: <GrowingSphere />,
    initial: { distance: 1 },
    next: { distance: 2 },
    shows: "caben 4 B. A B le llega 1/4",
    outside: { distance: 0 },
    error: "distance must be a whole number from 1 to 4",
    readerMove: click("Más: Distancia de B al centro"),
    readerShows: "caben 9 B. A B le llega 1/9",
  },
  {
    id: "hilos",
    section: "cualquiera",
    widget: <MassThreads />,
    initial: { massA: 2, massB: 3, distance: 1 },
    next: { massA: 4, massB: 1, distance: 2 },
    shows: "Fuerza: 4 × 1/4 = ×1",
    outside: { massA: 4, massB: 1, distance: 4 },
    error: "distance must be a whole number from 1 to 3",
    readerMove: click("Más: Bolitas de B"),
    readerShows: "Fuerza: 8 × 1/4 = ×2",
  },
  {
    id: "patinadores",
    section: "iguales",
    widget: <Skaters />,
    initial: { massA: 40, massB: 100 },
    next: { massA: 60, massB: 120 },
    shows: "El de la izquierda, 60 kg",
    outside: { massA: 50, massB: 120 },
    error: "massA must be a multiple of 20 from 20 to 200",
    readerMove: click("Más: Masa (derecha)"),
    readerShows: "El de la derecha, 140 kg",
  },
  {
    id: "astronautas",
    section: "mesa",
    widget: <Astronauts />,
    initial: { speed: "×1" },
    next: { speed: "×600" },
    shows: "cada segundo, diez minutos",
    outside: { speed: "×2" },
    error: "speed",
    readerMove: click("×60"),
    readerShows: "cada segundo, un minuto",
  },
];

describe.each(CASES)("the widget $id", (widget) => {
  it("registers in its section with its state", () => {
    const lesson = renderInSection(widget.section, widget.widget);

    const snapshot = lesson.controller().snapshot(widget.section);

    expect(snapshot).toEqual([{ ...widget.initial, widget: widget.id }]);
    expect(lesson.controller().widget(widget.id)?.section).toBe(widget.section);
  });

  it("is set from outside as if the reader moved it", () => {
    const lesson = renderInSection(widget.section, widget.widget);

    const result = set(lesson.controller(), widget.id, widget.next);

    expect(result).toEqual({ ok: true, state: widget.next });
    expect(lesson.container).toHaveTextContent(widget.shows);
    expect(lesson.controller().widget(widget.id)?.state).toEqual(widget.next);
  });

  it("rejects a state outside its schema, unchanged, naming the field", () => {
    const lesson = renderInSection(widget.section, widget.widget);
    const before = lesson.container.textContent;

    const result = set(lesson.controller(), widget.id, widget.outside);

    const namesTheField: unknown = expect.stringContaining(widget.error);
    expect(result).toEqual({ ok: false, error: namesTheField });
    expect(lesson.container.textContent).toBe(before);
    expect(lesson.controller().widget(widget.id)?.state).toEqual(
      widget.initial,
    );
  });

  it("stays in the reader's hands after a change from outside", () => {
    const lesson = renderInSection(widget.section, widget.widget);
    set(lesson.controller(), widget.id, widget.next);

    act(widget.readerMove);

    expect(lesson.container).toHaveTextContent(widget.readerShows);
  });

  it("keeps a change from outside for the next mount of the lesson", () => {
    const before = renderInSection(widget.section, widget.widget, withProgress);
    set(before.controller(), widget.id, widget.next);
    before.unmount();

    const lesson = renderInSection(widget.section, widget.widget, withProgress);

    expect(lesson.container).toHaveTextContent(widget.shows);
    expect(lesson.controller().widget(widget.id)?.state).toEqual(widget.next);
  });

  it("keeps the reader's own move for the next mount of the lesson", () => {
    const before = renderInSection(widget.section, widget.widget, withProgress);
    set(before.controller(), widget.id, widget.next);
    act(widget.readerMove);
    before.unmount();

    const lesson = renderInSection(widget.section, widget.widget, withProgress);

    expect(lesson.container).toHaveTextContent(widget.readerShows);
  });

  it("starts from its initial state when the saved one is not valid", () => {
    createProgressStore(PROGRESS_KEY).set(
      `widget:${widget.id}`,
      widget.outside,
    );

    const lesson = renderInSection(widget.section, widget.widget, withProgress);

    expect(lesson.controller().widget(widget.id)?.state).toEqual(
      widget.initial,
    );
  });

  it("shows the highlight when asked", () => {
    const lesson = renderInSection(widget.section, widget.widget);

    act(() => {
      lesson.controller().highlight(widget.id);
    });

    expect(
      lesson.container.querySelector("[data-highlighted]"),
    ).toBeInTheDocument();
  });

  it("neither registers nor saves its state outside the lesson's sections", () => {
    const seen: { controller?: LessonController } = {};
    function Probe(): ReactElement | null {
      seen.controller = useLessonController();
      return null;
    }
    render(
      withProgress(
        <LessonControllerProvider>
          <Probe />
          {widget.widget}
        </LessonControllerProvider>,
      ),
    );

    act(widget.readerMove);

    expect(seen.controller?.widget(widget.id)).toBeUndefined();
    expect(
      createProgressStore(PROGRESS_KEY).get(`widget:${widget.id}`),
    ).toBeUndefined();
  });
});

describe("a widget placed in another section than WIDGET_SECTIONS's", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps its section from WIDGET_SECTIONS and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const lesson = renderInSection("mesa", <Tower />);

    expect(lesson.controller().widget("ascensor")?.section).toBe("distancia");
    expect(lesson.controller().snapshot("distancia")).toEqual([
      { widget: "ascensor", distance: 1 },
    ]);
    expect(lesson.controller().snapshot("mesa")).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      'The widget "ascensor" is in the section "mesa", but belongs in "distancia".',
    );
  });
});
