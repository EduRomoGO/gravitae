// The lesson as the chat with Atomy reaches it (components/atomy/chat-surface.ts):
// its visible section, its widgets and the reader's predictions, and the
// lesson's tools run through its controller.

import type { ChatSurface } from "@/components/atomy/chat-surface";
import { chatSnapshot } from "@/components/learn/atomy/chat-snapshot";
import type { PredictionBook } from "@/components/learn/atomy/chat-predictions";
import { pageOf, sectionOnPage } from "@/components/learn/atomy/page-tools";
import type { LessonController } from "@/components/learn/lesson-controller";
import type { ExperimentContext } from "@/components/atomy/use-atomy-conversation";
import { PAGE_TOOLS } from "@/lib/atomy/client-tools";
import { notOnThisPage } from "@/lib/atomy/surface-tools";

export const LESSON_CHAT_API = "/api/atomy/chat";

const FINDER_TOOLS_ELSEWHERE = {
  set_seed: () => notOnThisPage("set_seed"),
  start_from: () => notOnThisPage("start_from"),
  close_orbit: () => notOnThisPage("close_orbit"),
} as const;

/** The lesson: its visible section, its widgets and the reader's predictions. */
export function lessonSurface(
  controller: LessonController | null,
  context: ExperimentContext | undefined,
  predictions: PredictionBook,
): ChatSurface {
  const page = pageOf(controller);
  return {
    api: LESSON_CHAT_API,
    snapshot: () => {
      const snapshot = chatSnapshot(
        context?.question,
        (section) => sectionOnPage(controller, section),
        predictions.all(),
      );
      return snapshot ? { snapshot } : null;
    },
    tools: {
      go_to_section: (input) =>
        Promise.resolve(PAGE_TOOLS.go_to_section.run(page, input)),
      set_widget: (input) =>
        Promise.resolve(PAGE_TOOLS.set_widget.run(page, input)),
      ...FINDER_TOOLS_ELSEWHERE,
    },
  };
}
