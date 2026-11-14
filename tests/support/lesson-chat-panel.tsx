import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LessonChat } from "@/components/learn/atomy/lesson-chat";

/**
 * The lesson's chat panel is a chunk of its own (next/dynamic): its first
 * render waits for the chunk. Opening it once before the tests leaves it
 * loaded, so each test finds it at once, as the page does once the chunk is
 * in.
 */
export async function loadLessonChatPanel(): Promise<void> {
  const { unmount } = render(<LessonChat>{null}</LessonChat>);
  await userEvent.click(
    screen.getByRole("button", { name: "Pregúntale a Atomy" }),
  );
  await screen.findByRole(
    "region",
    { name: "Chat con Atomy" },
    { timeout: 10_000 },
  );
  unmount();
}
