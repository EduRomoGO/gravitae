"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { useCardAttended } from "@/components/gallery/gallery-card-link";
import {
  useCardInstant,
  useGalleryPaused,
} from "@/components/gallery/gallery-return";
import { OrbitAnimation } from "@/components/gallery/orbit-animation-lazy";
import { useOrbitTurn } from "@/components/gallery/orbit-turns";
import { usePlaybackClock } from "@/components/gallery/use-playback-clock";
import {
  animationFrameScheduler,
  sharedFrameScheduler,
} from "@/lib/orbits/playback-clock";
import {
  GALLERY_LAP_SECONDS,
  GALLERY_LAPS,
} from "@/lib/orbits/playback-config";
import { getSolution, type SolutionSlug } from "@/lib/orbits/solutions";
import { Spinner } from "@/components/shared/spinner";

/** The cards' clocks run on one frame loop between them. */
const galleryFrames = sharedFrameScheduler(animationFrameScheduler);

/**
 * A card's orbit, which only animates while it is on screen and the gallery
 * is not paused. Every card draws a lap in the same real time and stops after
 * a few laps, unless the pointer or the keyboard focus is on it. It draws
 * when its turn comes (orbit-turns.ts), one card per task.
 */
export function OrbitThumbnail({ slug }: { slug: SolutionSlug }): ReactElement {
  const { period } = getSolution(slug);
  const attended = useCardAttended();
  const [paused] = useGalleryPaused();
  const frame = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const { initialInstant, keepInstant } = useCardInstant(slug);
  const turn = useOrbitTurn();
  const clock = usePlaybackClock({
    initialTime: initialInstant,
    initialPlaying: false,
    rate: period / GALLERY_LAP_SECONDS,
    until: GALLERY_LAPS * period,
    scheduler: galleryFrames,
  });

  useEffect(() => {
    if (onScreen && !paused) clock.play();
    else clock.pause();
  }, [clock, onScreen, paused]);

  useEffect(() => {
    clock.setUntil(attended ? Infinity : GALLERY_LAPS * period);
  }, [clock, attended, period]);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      const latest = entries.at(-1);
      if (latest) setOnScreen(latest.isIntersecting);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    keepInstant(() => clock.time());
  }, [keepInstant, clock]);

  // The square is reserved here, so the card is as tall with the spinner as
  // with the orbit, while it waits for its turn or its chunk. It lets the pointer through to the card's link: the orbit
  // replaces the spinner whenever it is ready, and a press that landed on the
  // spinner would lose its click, because the browser drops a click whose
  // press target left the page before the release.
  return (
    <div ref={frame} className="pointer-events-none aspect-square p-2">
      {turn.granted ? (
        <OrbitAnimation slug={slug} clock={clock} onDrawn={turn.drawn} />
      ) : (
        <Spinner label="Calculando la órbita" />
      )}
    </div>
  );
}
