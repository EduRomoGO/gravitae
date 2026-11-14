// The frame every experiment of the lesson sits in: a neutral border, the
// instructions on top and, below them, the drawing and its controls. An
// experiment registered with useRegisterWidget passes its `frame`, which adds
// Atomy's highlight when Atomy points at it.

import type { ReactElement, ReactNode } from "react";
import {
  frameOf,
  type WidgetFrame,
} from "@/components/learn/lesson-controller";

/** The text size of every paragraph inside an experiment. */
export const EXPERIMENT_TEXT_CLASS = "text-base sm:text-sm";

const NOT_HIGHLIGHTED = frameOf(false);

export function Experiment({
  instructions,
  frame = NOT_HIGHLIGHTED,
  children,
}: {
  instructions?: ReactNode;
  frame?: WidgetFrame;
  children: ReactNode;
}): ReactElement {
  return (
    <div
      {...frame(
        "space-y-4 rounded-xl border border-slate-300 p-4 dark:border-slate-700",
      )}
    >
      {instructions !== undefined && (
        <p className={EXPERIMENT_TEXT_CLASS}>{instructions}</p>
      )}
      {children}
    </div>
  );
}
