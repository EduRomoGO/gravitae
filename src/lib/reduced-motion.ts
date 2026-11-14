import { useSyncExternalStore } from "react";

/**
 * The media query that is true while the system asks for reduced motion. The
 * app reads it through the functions below; the tests' fake of matchMedia
 * answers it.
 */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Whether the system asks for reduced motion right now. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Calls `listener` each time the preference changes; returns the unsubscribe. */
export function subscribeReducedMotion(listener: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", listener);
  return () => {
    query.removeEventListener("change", listener);
  };
}

function prefersReducedMotionOnTheServer(): boolean {
  return false;
}

/**
 * Whether the system asks for reduced motion, rendered again when the
 * preference changes. The server cannot read it: the page is hydrated as
 * without it and renders again right after if the reader asked for it.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    prefersReducedMotionOnTheServer,
  );
}
