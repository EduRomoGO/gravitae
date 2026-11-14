"use client";

// How an experiment of the lesson keeps its state: under its id from
// lib/atomy/lesson-widgets, with that id's schema. Inside the lesson's
// sections its state is part of the reader's progress, under `widget:<id>`;
// outside them it keeps nothing and works on its own. It registers in the
// lesson controller with useRegisterWidget (learn/lesson-controller).

import { useLessonSection } from "@/components/learn/lesson/lesson-section";
import { usePersistentState } from "@/components/shared/progress";
import {
  WIDGET_STATES,
  type WidgetId,
  type WidgetStateOf,
} from "@/lib/lesson/widgets";

/**
 * The state of the experiment `id`, starting at `initial`: kept in the
 * lesson's progress inside the lesson's sections, plain state outside them.
 * A saved state its schema rejects counts as none.
 */
export function useWidgetState<Id extends WidgetId>(
  id: Id,
  initial: WidgetStateOf<Id>,
): [
  WidgetStateOf<Id>,
  (update: (current: WidgetStateOf<Id>) => WidgetStateOf<Id>) => void,
] {
  const inLesson = useLessonSection() !== undefined;
  return usePersistentState(
    inLesson ? `widget:${id}` : undefined,
    initial,
    WIDGET_STATES[id],
  );
}
