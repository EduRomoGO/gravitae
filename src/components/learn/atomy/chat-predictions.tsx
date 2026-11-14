"use client";

// The predictions the reader has made in the lesson, for the chat's
// snapshot: each prediction records, while the reader has picked an option,
// that option, whether the answer is checked and the verdict of Atomy's
// correction of the reasoning. The chat reads them when each request leaves.

import { createContext, useContext, useEffect, useId } from "react";
import type { PredictionMade } from "@/lib/atomy/chat-request";

/** The predictions recorded so far, in the order they were first made. */
export class PredictionBook {
  readonly #byKey = new Map<string, PredictionMade>();

  set(key: string, prediction: PredictionMade): void {
    this.#byKey.set(key, prediction);
  }

  delete(key: string): void {
    this.#byKey.delete(key);
  }

  all(): PredictionMade[] {
    return [...this.#byKey.values()];
  }
}

export const PredictionsContext = createContext<PredictionBook | null>(null);

/**
 * Records a prediction while it is made, and updates it as it changes;
 * null records nothing. Outside the chat it does nothing.
 */
export function useRecordPrediction(prediction: PredictionMade | null): void {
  const book = useContext(PredictionsContext);
  const key = useId();
  const { id, question, chosen, revealed, verdict } = prediction ?? {};
  useEffect(() => {
    if (
      book === null ||
      id === undefined ||
      question === undefined ||
      chosen === undefined ||
      revealed === undefined
    )
      return;
    book.set(key, {
      id,
      question,
      chosen,
      revealed,
      ...(verdict ? { verdict } : {}),
    });
    return () => {
      book.delete(key);
    };
  }, [book, key, id, question, chosen, revealed, verdict]);
}
