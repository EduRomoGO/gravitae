import { act, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MassThreads } from "@/components/learn/experiments/mass-threads";
import { Tower } from "@/components/learn/experiments/tower";
import {
  HIGHLIGHT_MS,
  LessonControllerProvider,
  type LessonController,
} from "@/components/learn/lesson-controller";
import { useLessonController } from "@tests/support/lesson-controller";
import { LessonSection } from "@/components/learn/lesson/lesson-section";

// The controller as the chat's client tools reach it: from a component
// inside the provider, not through the DOM. Each widget's own behaviour is
// in lesson-widgets.test.tsx; this is what the controller adds across them.
function renderLesson(): {
  controller: () => LessonController;
  tower: () => HTMLElement;
  threads: () => HTMLElement;
} {
  let controller: LessonController | null = null;
  function Probe(): ReactElement | null {
    controller = useLessonController();
    return null;
  }
  render(
    <LessonControllerProvider>
      <Probe />
      <section aria-label="ascensor">
        <LessonSection id="distancia">
          <Tower />
        </LessonSection>
      </section>
      <section aria-label="hilos">
        <LessonSection id="cualquiera">
          <MassThreads />
        </LessonSection>
      </section>
    </LessonControllerProvider>,
  );
  return {
    controller: () => {
      if (controller === null) throw new Error("No controller");
      return controller;
    },
    tower: () => screen.getByRole("region", { name: "ascensor" }),
    threads: () => screen.getByRole("region", { name: "hilos" }),
  };
}

describe("LessonController", () => {
  it("sets one widget without changing another", () => {
    const lesson = renderLesson();
    const threadsBefore = lesson.threads().textContent;

    let result: ReturnType<LessonController["setWidget"]> | undefined;
    act(() => {
      result = lesson.controller().setWidget("ascensor", { distance: 3 });
    });

    expect(result).toEqual({ ok: true, state: { distance: 3 } });
    expect(lesson.tower()).toHaveTextContent(
      "Peso de 1 kg: 9,8 ÷ (3 × 3) = 1,09 N",
    );
    expect(lesson.threads().textContent).toBe(threadsBefore);
  });

  it("gives a serializable snapshot of the widgets of a section", () => {
    const lesson = renderLesson();
    act(() => {
      lesson.controller().setWidget("ascensor", { distance: 2 });
    });

    const snapshot = lesson.controller().snapshot("distancia");

    const roundTrip: unknown = JSON.parse(JSON.stringify(snapshot));
    expect(roundTrip).toEqual(snapshot);
    expect(snapshot).toEqual([{ widget: "ascensor", distance: 2 }]);
    expect(lesson.controller().snapshot("mesa")).toEqual([]);
  });

  it("reports a widget that is not on the page", () => {
    const lesson = renderLesson();

    expect(lesson.controller().setWidget("esfera", { distance: 1 })).toEqual({
      ok: false,
      error: 'No widget with id "esfera"',
    });
  });

  it("gives the state of one widget by its id, wherever it is", () => {
    const lesson = renderLesson();
    act(() => {
      lesson.controller().setWidget("hilos", {
        massA: 3,
        massB: 1,
        distance: 2,
      });
    });

    expect(lesson.controller().widget("hilos")?.state).toEqual({
      massA: 3,
      massB: 1,
      distance: 2,
    });
    expect(lesson.controller().widget("esfera")).toBeUndefined();
  });

  describe("highlighting", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    function highlighted(region: HTMLElement): boolean {
      return region.querySelector("[data-highlighted]") !== null;
    }

    it("highlights one widget for a moment", () => {
      vi.useFakeTimers();
      const lesson = renderLesson();

      act(() => {
        lesson.controller().highlight("ascensor");
      });

      expect(highlighted(lesson.tower())).toBe(true);
      expect(highlighted(lesson.threads())).toBe(false);
      act(() => {
        vi.advanceTimersByTime(HIGHLIGHT_MS);
      });
      expect(highlighted(lesson.tower())).toBe(false);
    });
  });
});
