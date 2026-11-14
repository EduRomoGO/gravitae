"use client";

// The lesson's mode, as the page decides it: "ia" with Atomy's model in
// reach, "reduced" without it. The same values as the reader's choice
// (AtomyModeChoice), since the mode in effect is one of the two the reader
// can choose; it is "reduced" also when the choice is "ia" but the model is
// out of reach. The predictions read it to ask for the reader's reasoning;
// whether the chat opens is a separate question, which useOpenChat answers.

import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import type { AtomyModeChoice } from "@/components/atomy/atomy-cookie";

export type LessonMode = AtomyModeChoice;

const LessonModeContext = createContext<LessonMode>("reduced");

export function LessonModeProvider({
  mode,
  children,
}: {
  mode: LessonMode;
  children: ReactNode;
}): ReactElement {
  return (
    <LessonModeContext.Provider value={mode}>
      {children}
    </LessonModeContext.Provider>
  );
}

/** The lesson's mode; "reduced" outside a provider. */
export function useLessonMode(): LessonMode {
  return useContext(LessonModeContext);
}
