"use client";

// The lesson shown one step at a time. Every step
// ends with an experiment; once the reader resolves it, the next step
// appears below. Each step has an id, and <Steps> takes the ids in the order
// they unlock: inserting, removing or moving a step only edits that list.
// Several <Step> elements may share an id when one step spans more than one
// block, and <Revealed> holds the part of a step that shows once its
// experiment is resolved, at the same moment as the next step. With `showAll`, a
// temporary review mode, every step shows at once and every question comes
// answered.
// The id of the furthest step shown and the section the reader is in are part of the lesson's
// progress: a reload shows the same steps and goes back to that section. The
// review mode remembers nothing, so it does not touch the reader's progress.
// The lesson stays hidden while a reload restores the progress
// (restoring-veil.ts): it shows once the restored steps have rendered and the
// page is back in the reader's section.

import {
  createContext,
  useContext,
  useEffect,
  type ReactElement,
  type ReactNode,
} from "react";
import { z } from "zod";
import {
  usePersistentState,
  useProgress,
  WithoutProgress,
} from "@/components/shared/progress";
import { sectionInView } from "@/components/learn/lesson/lesson-sections-dom";
import type { ProgressStore } from "@/lib/progress/progress-store";
import { liftRestoringVeil } from "@/lib/progress/restoring-veil";

const StepsContext = createContext<{
  order: readonly string[];
  /** The position in `order` of the furthest step shown. */
  shown: number;
  show: (position: number) => void;
  showAll: boolean;
} | null>(null);
/** The position of the enclosing step in the order of <Steps>. */
const StepPosition = createContext<number | null>(null);

const SHOWN_KEY = "paso";
const SECTION_KEY = "seccion";
const shownSchema = z.string();
const sectionSchema = z.string().nullable();
/** How many frames the restored steps get to appear before giving up on the section. */
const RESTORE_FRAMES = 30;

/**
 * Goes back to the saved section once it is on the page, then follows the
 * section the reader is in.
 */
function useSectionMemory(store: ProgressStore | null, restore: boolean) {
  useEffect(() => {
    if (!store) {
      liftRestoringVeil();
      return;
    }
    let frame = 0;
    let tracking = false;
    let last = sectionSchema.safeParse(store.get(SECTION_KEY)).data ?? null;
    const track = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const current = sectionInView();
        if (current === last) return;
        last = current;
        store.set(SECTION_KEY, current);
      });
    };
    const startTracking = () => {
      tracking = true;
      window.addEventListener("scroll", track, { passive: true });
    };
    const target = restore ? last : null;
    // Seeks in the frames to come, by when the restored steps have rendered.
    let tries = 0;
    const seek = () => {
      const section = target === null ? null : document.getElementById(target);
      tries += 1;
      if (section) section.scrollIntoView({ block: "start" });
      if (target === null || section || tries >= RESTORE_FRAMES) {
        frame = 0;
        liftRestoringVeil();
        startTracking();
        return;
      }
      frame = requestAnimationFrame(seek);
    };
    frame = requestAnimationFrame(seek);
    return () => {
      cancelAnimationFrame(frame);
      if (tracking) window.removeEventListener("scroll", track);
    };
    // Only on mount: a later change of `restore` must not scroll again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);
}

/** The position of `id` in `order`; an id no longer in it counts as the first. */
function positionOf(order: readonly string[], id: string): number {
  return Math.max(0, order.indexOf(id));
}

export function Steps({
  order,
  showAll = false,
  children,
}: {
  /** The ids of the steps, in the order they unlock. */
  order: readonly string[];
  showAll?: boolean;
  children: ReactNode;
}): ReactElement {
  const progress = useProgress();
  const last = order.at(-1) ?? "";
  const [shownId, update] = usePersistentState(
    showAll ? undefined : SHOWN_KEY,
    showAll ? last : (order[0] ?? ""),
    shownSchema,
  );
  const shown = positionOf(order, shownId);
  const show = (position: number) => {
    const next = order[position];
    if (next === undefined) return;
    update((current) =>
      positionOf(order, current) >= position ? current : next,
    );
  };
  useSectionMemory(
    showAll ? null : (progress?.store ?? null),
    progress?.restoreScroll ?? false,
  );
  const steps = (
    <StepsContext.Provider value={{ order, shown, show, showAll }}>
      {children}
    </StepsContext.Provider>
  );
  return showAll ? <WithoutProgress>{steps}</WithoutProgress> : steps;
}

/** A step, or a part of one, shown once the step `id` unlocks. */
export function Step({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}): ReactElement | null {
  const steps = useContext(StepsContext);
  if (!steps)
    return (
      <StepPosition.Provider value={null}>{children}</StepPosition.Provider>
    );
  const position = steps.order.indexOf(id);
  if (position === -1)
    throw new Error(`The step "${id}" is not in the order of <Steps>.`);
  if (position > steps.shown) return null;
  return (
    <StepPosition.Provider value={position}>{children}</StepPosition.Provider>
  );
}

/**
 * The part of the enclosing step that shows once its experiment is resolved,
 * with the next step.
 */
export function Revealed({
  children,
}: {
  children: ReactNode;
}): ReactElement | null {
  const steps = useContext(StepsContext);
  const position = useContext(StepPosition);
  if (steps && !steps.showAll && position !== null && position >= steps.shown)
    return null;
  return <>{children}</>;
}

/** True in the review mode, where every question starts answered. */
export function useShowAll(): boolean {
  return useContext(StepsContext)?.showAll ?? false;
}

/** Called by an experiment when the reader resolves it: shows the next step. */
export function useResolveStep(): () => void {
  const steps = useContext(StepsContext);
  const position = useContext(StepPosition);
  return () => {
    if (steps && position !== null) steps.show(position + 1);
  };
}
