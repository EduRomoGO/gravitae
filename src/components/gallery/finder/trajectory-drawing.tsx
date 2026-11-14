"use client";

import { useMemo, type ReactElement } from "react";
import { BodiesDrawing } from "@/components/gallery/bodies-drawing";
import {
  fourDecimals,
  frameOf,
  pathData,
} from "@/components/gallery/orbit-drawing";
import { motionOf, type Trajectory } from "@/lib/orbits/lap";
import type { PlaybackClock } from "@/lib/orbits/playback-clock";

/**
 * The bodies of a simulated seed moving along their open paths, from t = 0
 * to where the simulation ended, the time reached or a collision. The clock
 * owns the instant drawn; the whole paths and the trails can be hidden.
 */
export function TrajectoryDrawing({
  trajectory,
  clock,
  showTrail,
  showPath,
  label,
}: {
  trajectory: Trajectory;
  clock: PlaybackClock;
  showTrail: boolean;
  showPath: boolean;
  label: string;
}): ReactElement {
  const motion = useMemo(() => motionOf(trajectory), [trajectory]);
  const frame = useMemo(() => frameOf(trajectory.paths), [trajectory]);
  const paths = useMemo(
    () => trajectory.paths.map((path) => pathData(path, fourDecimals)),
    [trajectory],
  );

  return (
    <BodiesDrawing
      motion={motion}
      paths={paths}
      frame={frame}
      clock={clock}
      showTrail={showTrail}
      showPath={showPath}
      label={label}
    />
  );
}
