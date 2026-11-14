"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { SolutionSlug } from "@/lib/orbits/solutions";
import {
  prefersReducedMotion,
  subscribeReducedMotion,
} from "@/lib/reduced-motion";

/**
 * The gallery looks as it was left when the reader comes back from a detail:
 * same scroll, focus on the card that was followed, each card's animation at
 * the instant it was left at, and the animations paused if they were.
 *
 * React unmounts the gallery on navigation; this module's state survives it
 * and lasts until the tab is reloaded.
 */

interface Departure {
  scrollY: number;
  slug: SolutionSlug;
}

// Stays after it is read, because a Forward and Back later the gallery must be
// restored again and browser navigation does not go through the card's link.
let departure: Departure | undefined;

const instants = new Map<SolutionSlug, number>();

function cardId(slug: SolutionSlug): string {
  return `gallery-card-${slug}`;
}

/**
 * The element the URL's hash names, such as an explanation a detail links to.
 * A hash that is not valid percent-encoding, such as `#%E0`, names none.
 */
function hashTarget(): HTMLElement | null {
  let id: string;
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch (error) {
    if (error instanceof URIError) return null;
    throw error;
  }
  return id === "" ? null : document.getElementById(id);
}

/**
 * Puts the gallery back where it was left, before the browser paints it. A
 * hash in the URL prevails: the reader followed a link to that part of it.
 */
export function GalleryReturn(): null {
  useLayoutEffect(() => {
    const target = hashTarget();
    if (target) {
      target.scrollIntoView();
      return;
    }
    window.scrollTo(0, departure?.scrollY ?? 0);
    if (departure) {
      document
        .getElementById(cardId(departure.slug))
        ?.focus({ preventScroll: true });
    }
  }, []);

  return null;
}

/** Props spread on a card's link: the id the return focuses, and recording the departure. */
export interface CardDeparture {
  id: string;
  onNavigate: () => void;
}

/** What a card's link needs so the gallery comes back to it. */
export function useCardDeparture(slug: SolutionSlug): CardDeparture {
  const onNavigate = () => {
    departure = { scrollY: window.scrollY, slug };
  };
  return { id: cardId(slug), onNavigate };
}

export interface CardInstant {
  /** Where the card's animation was left; a card never left starts at 0. */
  initialInstant: number;
  /** Registers how to read the card's instant; it is read when the card unmounts. */
  keepInstant: (read: () => number) => void;
}

/** What a card's animation needs to start again at the instant it was left at. */
export function useCardInstant(slug: SolutionSlug): CardInstant {
  const [initialInstant] = useState(() => instants.get(slug) ?? 0);
  const reader = useRef<(() => number) | undefined>(undefined);

  const keepInstant = (read: () => number) => {
    reader.current = read;
  };

  useEffect(
    () => () => {
      const read = reader.current;
      if (read) instants.set(slug, read());
    },
    [slug],
  );

  return { initialInstant, keepInstant };
}

// Undefined until the reader presses the pause button; until then the gallery
// follows the system's reduced motion preference.
let chosenPause: boolean | undefined;

const pauseListeners = new Set<() => void>();

// `isPaused` reads the preference, so React must hear when it changes: without
// the `change` listener, a preference changed with the gallery open would only
// show up at whatever render came next.
function subscribeToPause(listener: () => void): () => void {
  pauseListeners.add(listener);
  const unsubscribe = subscribeReducedMotion(listener);
  return () => {
    pauseListeners.delete(listener);
    unsubscribe();
  };
}

function isPaused(): boolean {
  return chosenPause ?? prefersReducedMotion();
}

// The server cannot read the preference; the gallery is hydrated playing and
// paused right after if the reader asked to reduce motion.
function isPausedOnTheServer(): boolean {
  return false;
}

function choosePause(paused: boolean): void {
  chosenPause = paused;
  pauseListeners.forEach((listener) => {
    listener();
  });
}

/**
 * Whether every card of the gallery is paused, and how to choose it. The
 * choice prevails over the reduced motion preference until the tab is reloaded.
 */
export function useGalleryPaused(): [
  paused: boolean,
  setPaused: (paused: boolean) => void,
] {
  const paused = useSyncExternalStore(
    subscribeToPause,
    isPaused,
    isPausedOnTheServer,
  );
  return [paused, choosePause];
}
