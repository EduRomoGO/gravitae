"use client";

import { useEffect, type ReactElement } from "react";
import { BodiesDrawing } from "@/components/gallery/bodies-drawing";
import { getLap } from "@/lib/orbits/cache";
import type { Lap } from "@/lib/orbits/lap";
import type { PlaybackClock } from "@/lib/orbits/playback-clock";
import { BODY_INDICES, type SolutionSlug } from "@/lib/orbits/solutions";
import { lapTrails, type LapTrails } from "@/lib/orbits/trail-dash";
import {
  fourDecimals,
  frameOf,
  pathData,
  type Frame,
} from "@/components/gallery/orbit-drawing";

interface OrbitDrawing {
  /** SVG path data of each body's closed orbit. */
  paths: readonly string[];
  frame: Frame;
  trails: LapTrails;
}

// Keyed by the cached lap, so the paths are built once per solution and
// remounting a card or a detail reuses them, like the lap itself.
const drawings = new WeakMap<Lap, OrbitDrawing>();

function drawingOf(lap: Lap): OrbitDrawing {
  const cached = drawings.get(lap);
  if (cached) return cached;
  const orbitPaths = BODY_INDICES.map((body) => lap.pathOf(body));
  const drawing = {
    paths: orbitPaths.map((path) => `${pathData(path, fourDecimals)}Z`),
    frame: frameOf(orbitPaths),
    trails: lapTrails(lap),
  };
  drawings.set(lap, drawing);
  return drawing;
}

/** A catalogue solution, whose lap is cached, or a lap calculated elsewhere. */
export type OrbitSource =
  | { readonly slug: SolutionSlug; readonly lap?: never }
  | { readonly lap: Lap; readonly slug?: never };

type OrbitAnimationProps = OrbitSource & {
  /** Owns the instant drawn; the animation redraws on each of its ticks. */
  clock: PlaybackClock;
  showTrail?: boolean;
  showOrbit?: boolean;
  /** Accessible name of the drawing; without one, the gallery's link names it. */
  label?: string;
  /** Called once the drawing is on the page. */
  onDrawn?: () => void;
};

/** The bodies of a lap going round their closed orbits, lap after lap. */
export default function OrbitAnimation({
  clock,
  showTrail = true,
  showOrbit = true,
  label,
  onDrawn,
  ...source
}: OrbitAnimationProps): ReactElement {
  // Calculated during render, in the browser only: see OrbitPlayer.
  const lap = source.lap ?? getLap(source.slug);
  const { paths, frame, trails } = drawingOf(lap);
  useEffect(() => {
    onDrawn?.();
  }, [onDrawn]);

  return (
    <BodiesDrawing
      motion={lap}
      paths={paths}
      frame={frame}
      trails={trails}
      clock={clock}
      showTrail={showTrail}
      showPath={showOrbit}
      label={label}
    />
  );
}
