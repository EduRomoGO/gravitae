"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { formatLapTime } from "@/lib/format";
import type { PlaybackClock } from "@/lib/orbits/playback-clock";

function lapAt(time: number, period: number) {
  const completedLaps = Math.floor(time / period);
  return {
    lapTime: formatLapTime(time - completedLaps * period),
    lap: String(completedLaps + 1),
  };
}

interface LapReadoutProps {
  /** The clock whose instant is shown, the same one the animation draws. */
  clock: PlaybackClock;
  period: number;
}

/**
 * Writes to the DOM directly: the text changes on nearly every tick. The lap
 * time sits in a box as wide as the period, so the text after it keeps its
 * place when the time gains a digit.
 */
export function LapReadout({ clock, period }: LapReadoutProps): ReactElement {
  const lapTimeRef = useRef<HTMLSpanElement>(null);
  const lapRef = useRef<HTMLSpanElement>(null);
  const shownPeriod = formatLapTime(period);
  const initial = lapAt(clock.time(), period);

  useEffect(() => {
    const show = (time: number) => {
      const { lapTime, lap } = lapAt(time, period);
      if (lapTimeRef.current && lapTimeRef.current.textContent !== lapTime) {
        lapTimeRef.current.textContent = lapTime;
      }
      if (lapRef.current && lapRef.current.textContent !== lap) {
        lapRef.current.textContent = lap;
      }
    };
    // The instant may have moved between the render and the effect.
    show(clock.time());
    return clock.subscribe(show);
  }, [clock, period]);

  return (
    <p className="mt-2 text-sm text-slate-600 tabular-nums dark:text-slate-400">
      t ={" "}
      <span
        ref={lapTimeRef}
        className="inline-block text-right"
        style={{ minWidth: `${String(shownPeriod.length)}ch` }}
      >
        {initial.lapTime}
      </span>{" "}
      de {shownPeriod} · vuelta <span ref={lapRef}>{initial.lap}</span>
    </p>
  );
}
