import { act, render } from "@testing-library/react";
import { useEffect, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GravitationLawPage from "@/app/ley-gravitacion-universal-newton/page";
import {
  HIGHLIGHT_MS,
  LessonControllerProvider,
  type LessonController,
} from "@/components/learn/lesson-controller";
import { useLessonController } from "@tests/support/lesson-controller";
import { SECTION_SELECTOR } from "@/components/learn/lesson/lesson-sections-dom";
import {
  WIDGET_IDS,
  WIDGET_SECTIONS,
  type WidgetId,
} from "@/lib/lesson/widgets";

// The lesson as the reader gets it, with every widget Atomy can drive: each
// one must be inside the section WIDGET_SECTIONS says, or the snapshot of
// that section would leave it out and the chat's tools would refuse it.

// A reader who has already met Atomy: the lesson, without its presentation.
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => ({ value: "seen" }) }),
}));

// Every step at once: the lesson shows its sections one step at a time.
vi.mock("@/components/learn/lesson/steps", () => ({
  Steps: ({ children }: { children: ReactNode }) => children,
  Step: ({ children }: { children: ReactNode }) => children,
  Revealed: ({ children }: { children: ReactNode }) => children,
  useResolveStep: () => () => undefined,
  useShowAll: () => false,
}));

// Every prediction answered: an experiment shows once its question is.
vi.mock("@/components/learn/lesson/predict", () => ({
  Predict: ({ children }: { children: ReactNode }) => children,
}));

const seen: { controller?: LessonController } = {};

function Probe(): ReactElement | null {
  const controller = useLessonController();
  useEffect(() => {
    seen.controller = controller;
  });
  return null;
}

// The gate only decides whether the presentation shows first; here the
// lesson sits in a controller the test can read.
vi.mock("@/components/learn/atomy/atomy-lesson-gate", () => ({
  AtomyLessonGate: ({ children }: { children: ReactNode }) => (
    <LessonControllerProvider>
      <Probe />
      {children}
    </LessonControllerProvider>
  ),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * The id of the section the widget `id` sits in on the page: the controller
 * highlights it, which marks its outer element, and the section is the one
 * around that element.
 */
function sectionOnPage(controller: LessonController, id: WidgetId) {
  act(() => {
    controller.highlight(id);
  });
  const highlighted = document.querySelectorAll("[data-highlighted]");
  const section = highlighted[0]?.closest(SECTION_SELECTOR)?.id;
  act(() => {
    vi.advanceTimersByTime(HIGHLIGHT_MS);
  });
  return { highlighted: highlighted.length, section };
}

describe("the lesson's widgets", () => {
  it("are each in the section WIDGET_SECTIONS says", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const page = await GravitationLawPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({}),
    });

    render(page);

    vi.useFakeTimers();

    const controller = seen.controller;
    if (controller === undefined) throw new Error("No lesson controller");
    const sections = WIDGET_IDS.map((id) => ({
      id,
      ...sectionOnPage(controller, id),
    }));
    expect(sections).toEqual(
      WIDGET_IDS.map((id) => ({
        id,
        highlighted: 1,
        section: WIDGET_SECTIONS[id],
      })),
    );
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("but belongs in"),
    );
  });
});
