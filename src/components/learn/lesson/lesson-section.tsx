"use client";

// The lesson's section a widget is in, for the widgets that register in the
// lesson controller under it. Outside a section there is none, and the
// widgets do not register.

import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import type { SectionId } from "@/lib/lesson/sections";

const SectionContext = createContext<SectionId | undefined>(undefined);

export function LessonSection({
  id,
  children,
}: {
  id: SectionId;
  children: ReactNode;
}): ReactElement {
  return (
    <SectionContext.Provider value={id}>{children}</SectionContext.Provider>
  );
}

/** The id of the section around, or undefined outside the lesson's sections. */
export function useLessonSection(): SectionId | undefined {
  return useContext(SectionContext);
}
