// The snapshot of the page the chat sends with each question: the section the
// reader is looking at, read from the lesson as rendered, the experiment the
// chat was opened from, and the widgets of the visible section, which the
// chat reads from the lesson controller. The route
// handler validates it again.

import type { ChatSnapshot } from "@/lib/atomy/chat-request";
import {
  MAX_EXPERIMENT_CHARS,
  MAX_SECTION_TEXT_CHARS,
  MAX_SECTION_TITLE_CHARS,
} from "@/lib/atomy/lesson-limits";
import { isSectionId, type SectionId } from "@/lib/lesson/sections";
import {
  INTERFACE_SELECTOR,
  sectionElement,
  sectionElements,
  sectionInView,
} from "@/components/learn/lesson/lesson-sections-dom";

export function plainText(element: Element, maxChars: number): string {
  // innerText follows the layout (hidden steps, line breaks); jsdom lacks it.
  const text =
    element instanceof HTMLElement && element.innerText
      ? element.innerText
      : element.textContent;
  return text.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

/**
 * The id of the lesson's section the reader is in; the first section while
 * the reader is above them all.
 */
export function visibleSectionId(): SectionId | null {
  return sectionInView() ?? firstSectionId();
}

function firstSectionId(): SectionId | null {
  const first = sectionElements()[0];
  return first && isSectionId(first.id) ? first.id : null;
}

/** The title of one of the lesson's sections, while the section is shown. */
export function sectionHeading(id: SectionId): HTMLElement | null {
  const section = sectionElement(id);
  if (!section) return null;
  return document.getElementById(section.getAttribute("aria-labelledby") ?? "");
}

/** A section of the lesson as the model reads it: its id, title and text. */
export function sectionContent(
  section: Element,
  id: SectionId,
): ChatSnapshot["section"] {
  const heading = sectionHeading(id);
  const title = heading ? plainText(heading, MAX_SECTION_TITLE_CHARS) : "";
  return {
    id,
    title: title || id,
    text: plainText(section, MAX_SECTION_TEXT_CHARS),
  };
}

/** What is never lesson text: the interface, and what screen readers skip. */
const NOT_TEXT = `${INTERFACE_SELECTOR}, [hidden], [aria-hidden="true"], svg, script, style`;

/** Elements that flow inside a line of text: no break around them. */
const INLINE = new Set([
  "A",
  "ABBR",
  "B",
  "CODE",
  "EM",
  "I",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
]);

/** The nearest element around `node` that is not inline. */
function lineOf(node: Node): Element | null {
  let element = node.parentElement;
  while (element && INLINE.has(element.tagName))
    element = element.parentElement;
  return element;
}

/**
 * The lesson's text in `element`, without its interface (fields, buttons,
 * experiments: INTERFACE_SELECTOR), in reading order, on one line. Text of
 * different blocks is separated by a space, as innerText would break it.
 */
export function lessonText(element: Element, maxChars: number): string {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        node instanceof Element && node.matches(NOT_TEXT)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    },
  );
  let text = "";
  let line: Element | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent) continue;
    const current = lineOf(node);
    text += (current === line ? "" : " ") + node.textContent;
    line = current;
  }
  return text.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

/**
 * A section of the lesson as the correction reads it: its id, title and the
 * lesson's text in it, without the interface.
 */
export function lessonContent(
  section: Element,
  id: SectionId,
): ChatSnapshot["section"] {
  return {
    ...sectionContent(section, id),
    text: lessonText(section, MAX_SECTION_TEXT_CHARS),
  };
}

/** What the page shows of one section: its widgets. */
export type SectionState = Pick<ChatSnapshot, "widgets">;

export function chatSnapshot(
  experiment: string | undefined,
  sectionState: (section: SectionId) => SectionState = () => ({ widgets: [] }),
  predictions: ChatSnapshot["predictions"] = [],
): ChatSnapshot | null {
  const id = visibleSectionId();
  const section = id && sectionElement(id);
  if (!id || !section) return null;
  return {
    section: sectionContent(section, id),
    ...(experiment
      ? { experiment: experiment.slice(0, MAX_EXPERIMENT_CHARS) }
      : {}),
    ...sectionState(id),
    predictions,
  };
}
