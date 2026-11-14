"use client";

// Atomy, the guide of the lesson. Decorative: whatever Atomy says goes in
// text next to it, so the drawing is hidden from assistive technology.

import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";
import { useReducedMotion } from "@/lib/reduced-motion";
import "./atomy.css";
import { ATOMY_SVG } from "./atomy-svg";

/** talking moves the mouth; idle smiles and floats; stopped is still. */
export type AtomyState = "talking" | "idle" | "stopped";

/** The parts that move by transform, and how long one takes to settle. The
 * breathing moves the <svg> itself. */
const SETTLING_PARTS = ".atom-sway, .atom-face, .atom-eyes, .atom-pupils";
const SETTLE_MS = 400;

/** Where an electron is on its orbit, and whether it is going round. */
function lapOf(electron: SVGElement): {
  distance: string;
  duration: string;
  running: boolean;
} {
  const style = getComputedStyle(electron);
  return {
    distance: style.offsetDistance,
    duration: style.animationDuration,
    running: style.animationName !== "none",
  };
}

/** Whether the element is in the viewport; true until the browser says otherwise. */
function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      const latest = entries.at(-1);
      if (latest) setOnScreen(latest.isIntersecting);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return onScreen;
}

/**
 * Colors come from custom properties on any ancestor: `--atom-ink` for the
 * face lines, `--atom-orbit` for the orbits, `--atom-fill` for the body.
 */
export function Atomy({
  state,
  className = "",
}: {
  state: AtomyState;
  className?: string;
}): ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  // The markup is set once: replacing it would restart every animation.
  const [markup] = useState(() =>
    ATOMY_SVG.replace('data-state="talking"', `data-state="${state}"`),
  );

  const settling = useRef<Animation[]>([]);
  const reducedMotion = useReducedMotion();
  const onScreen = useOnScreen(ref);

  // Off screen, the CSS animations hold where they are (atomy.css): they move
  // parts inside the drawing, which the compositor cannot take over, so each
  // frame would restyle and lay out a drawing nobody sees.
  useEffect(() => {
    const svg = ref.current?.querySelector("svg");
    svg?.toggleAttribute("data-offscreen", !onScreen);
  }, [onScreen]);

  useEffect(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    // Removing a CSS animation drops its part to rest at once. Each part a
    // state leaves still is eased from the pose it had, read before the switch.
    const parts = [svg, ...svg.querySelectorAll<SVGElement>(SETTLING_PARTS)];
    const poses = parts.map((part) => getComputedStyle(part).transform);
    const electrons = [...svg.querySelectorAll<SVGElement>(".atom-electron")];
    const laps = electrons.map((electron) => lapOf(electron));
    for (const animation of settling.current) animation.cancel();
    svg.setAttribute("data-state", state);
    // An electron that stops stays where it was, and one that starts again
    // carries on from there instead of from where its lap begins.
    electrons.forEach((electron, i) => {
      const before = laps[i];
      const after = lapOf(electron);
      if (!before || before.running === after.running) return;
      if (before.running) {
        electron.style.offsetDistance = before.distance;
        return;
      }
      const done = Number.parseFloat(before.distance) / 100;
      const seconds = Number.parseFloat(after.duration);
      if (Number.isFinite(done) && Number.isFinite(seconds)) {
        electron.style.animationDelay = `${String(-done * seconds)}s`;
      }
    });
    settling.current = parts.flatMap((part, i) => {
      const pose = poses[i];
      if (!pose || pose === "none") return [];
      if (getComputedStyle(part).animationName !== "none") return [];
      return [
        part.animate([{ transform: pose }, { transform: "none" }], {
          duration: SETTLE_MS,
          easing: "ease-out",
        }),
      ];
    });
  }, [state]);

  // The mouth is a SMIL animation, which CSS cannot stop: its timeline is
  // paused by hand, or it keeps repainting while hidden.
  useEffect(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    if (state === "talking" && !reducedMotion && onScreen) {
      svg.unpauseAnimations();
    } else {
      svg.pauseAnimations();
    }
  }, [state, reducedMotion, onScreen]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`block ${className}`}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/**
 * Talks for `ms` after mounting, then idles. A new `turn` makes it talk
 * again, for `ms` from then.
 */
export function useTalkThenIdle(ms = 2500, turn: unknown = null): AtomyState {
  // The turn whose talk is over; none at first.
  const [quietTurn, setQuietTurn] = useState<{ turn: unknown } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuietTurn({ turn });
    }, ms);
    return () => {
      clearTimeout(timer);
    };
  }, [ms, turn]);
  return quietTurn && Object.is(quietTurn.turn, turn) ? "idle" : "talking";
}
