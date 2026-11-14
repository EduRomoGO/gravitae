"use client";

import { useState, useSyncExternalStore } from "react";
import {
  animationFrameScheduler,
  createPlaybackClock,
  type PlaybackClock,
  type PlaybackClockOptions,
  type PlaybackState,
} from "@/lib/orbits/playback-clock";

/**
 * A clock for the lifetime of the component, built from the options of its
 * first render. Its loop runs only while something subscribes, so a clock
 * created during a server render requests no frames. Its frames come from
 * the browser's frame loop unless a scheduler is given.
 */
export function usePlaybackClock(
  options: Omit<PlaybackClockOptions, "scheduler"> &
    Partial<Pick<PlaybackClockOptions, "scheduler">> = {},
): PlaybackClock {
  const [clock] = useState(() =>
    createPlaybackClock({ scheduler: animationFrameScheduler, ...options }),
  );
  return clock;
}

/** The clock's `{ playing, speed }`, re-rendering when it changes. */
export function usePlaybackState(clock: PlaybackClock): PlaybackState {
  return useSyncExternalStore(
    (listener) => clock.subscribeState(listener),
    () => clock.state(),
    () => clock.state(),
  );
}
