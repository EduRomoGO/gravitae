// The lesson's sections as the page renders them: a <section> with the id of
// one of SECTION_IDS, labelled by its title. The only place that knows that
// markup, and the only one that decides which section the reader is in, so
// the chat's snapshot, Atomy's tools and the lesson's progress agree on it.
// It also marks what of a section is interface rather than lesson.

import { isSectionId, type SectionId } from "@/lib/lesson/sections";

/**
 * Marks the lesson's interface inside a section (fields, buttons, the
 * experiment's widget), which is not part of the text the model reads.
 */
export const INTERFACE_SELECTOR = "[data-atomy-ignore]";

/** The props that mark an element as interface. */
export const INTERFACE = { "data-atomy-ignore": "" } as const;

/** The markup of a section; lib/lesson/sections.test.tsx checks the page with it. */
export const SECTION_SELECTOR = "section[id][aria-labelledby]";

/**
 * A section counts as the reader's once its top passes this share of the
 * screen. A reload scrolls the saved section to the top of the screen: a lower
 * line would save sections whose top is still far down, and the reload would
 * skip the end of the section the reader was reading.
 */
export const READING_LINE = 0.3;

/** The lesson's sections on the page, in their order. */
export function sectionElements(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(SECTION_SELECTOR)].filter(
    (section) => isSectionId(section.id),
  );
}

/** The lesson's section `id`, while it is shown. */
export function sectionElement(id: SectionId): HTMLElement | null {
  const section = document.getElementById(id);
  return section?.matches(SECTION_SELECTOR) ? section : null;
}

/**
 * The last section whose top is at or above `line`, in pixels from the top of
 * the viewport; null while every section is below it.
 */
export function sectionAt(line: number): SectionId | null {
  let current: SectionId | null = null;
  for (const section of sectionElements()) {
    if (section.getBoundingClientRect().top <= line && isSectionId(section.id))
      current = section.id;
  }
  return current;
}

/** The section the reader is in, or null while they are above them all. */
export function sectionInView(): SectionId | null {
  return sectionAt(window.innerHeight * READING_LINE);
}
