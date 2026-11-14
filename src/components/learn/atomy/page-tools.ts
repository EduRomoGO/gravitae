// The page as the tools of lib/atomy/client-tools reach it: the lesson
// controller's widgets, the section the reader is looking at, read from the
// lesson as rendered, and the move to a section's title. Also what the chat's
// snapshot reads of the page: the widgets of a section.

import type { LessonController } from "@/components/learn/lesson-controller";
import {
  plainText,
  sectionHeading,
  visibleSectionId,
  type SectionState,
} from "@/components/learn/atomy/chat-snapshot";
import type { Page } from "@/lib/atomy/client-tools";
import type { SectionId } from "@/lib/lesson/sections";

const NO_WIDGET = {
  ok: false,
  error: "The lesson's controller is not on the page.",
} as const;

/** Scrolls to the section's title and focuses it; its title, or null. */
function goToSection(section: SectionId): string | null {
  const heading = sectionHeading(section);
  if (!heading) return null;
  // A heading takes focus from code only, never from the Tab key.
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  // Instant, so the snapshot of the next request already sees the section.
  heading.scrollIntoView({ block: "start" });
  heading.focus({ preventScroll: true });
  return plainText(heading, 200);
}

/** The page of the lesson, through its controller and its document. */
export function pageOf(controller: LessonController | null): Page {
  return {
    widget: (id) => controller?.widget(id),
    setWidget: (id, next) => controller?.setWidget(id, next) ?? NO_WIDGET,
    highlight: (id) => {
      controller?.highlight(id);
    },
    visibleSection: visibleSectionId,
    goToSection,
  };
}

/** The widgets of `section`, for the snapshot. */
export function sectionOnPage(
  controller: LessonController | null,
  section: SectionId,
): SectionState {
  return { widgets: controller?.snapshot(section) ?? [] };
}
