import { act } from "@testing-library/react";
import { vi } from "vitest";

// The experiments animate with requestAnimationFrame and read the time from
// performance.now(). These fake timers drive both from the test.

export function installFakeAnimationFrames(): void {
  vi.useFakeTimers({
    toFake: [
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
      "setTimeout",
      "clearTimeout",
    ],
  });
}

/** Lets `ms` of animation run, frame by frame. */
export function advanceFrames(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** The interval of the fake requestAnimationFrame, in milliseconds. */
const FRAME_MS = 16;

/**
 * Lets `ms` of animation run with React committing after each frame, as the
 * browser does, instead of once at the end as `advanceFrames` does.
 */
export function advanceFrameByFrame(ms: number): void {
  for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS)
    advanceFrames(FRAME_MS);
}
