"use client";

import {
  useLayoutEffect,
  useRef,
  type ReactElement,
  type RefObject,
} from "react";
import { BODY_COLORS } from "@/components/shared/body-colors";
import {
  fourDecimals,
  pathData,
  type Frame,
} from "@/components/gallery/orbit-drawing";
import type { Motion } from "@/lib/orbits/lap";
import type { PlaybackClock } from "@/lib/orbits/playback-clock";
import { BODY_INDICES } from "@/lib/orbits/solutions";
import type { LapTrails } from "@/lib/orbits/trail-dash";

/** Width of a trail on screen, in CSS pixels. */
const TRAIL_WIDTH_PX = 2.5;

/** The nodes a frame writes, found once when the drawing mounts. */
interface MovingParts {
  bodies: readonly SVGCircleElement[];
  trails: readonly SVGPathElement[];
}

function movingPartsOf(drawing: SVGSVGElement): MovingParts {
  return {
    bodies: [...drawing.querySelectorAll("circle")],
    trails: [
      ...drawing.querySelectorAll<SVGPathElement>('path[data-part="trail"]'),
    ],
  };
}

/**
 * Writes to the DOM directly: a React render per frame would touch the whole
 * drawing. A lap's trails move as dashes along its paths, two attributes
 * each; other trails are rebuilt as path data.
 */
function draw(
  motion: Motion,
  lapTrails: LapTrails | undefined,
  time: number,
  { bodies, trails }: MovingParts,
) {
  const positions = motion.positionsAt(time);
  BODY_INDICES.forEach((body) => {
    const [x, y] = positions[body];
    bodies[body]?.setAttribute("cx", String(x));
    bodies[body]?.setAttribute("cy", String(-y));
    const trail = trails[body];
    if (!trail) return;
    if (lapTrails) {
      const { offset, length } = lapTrails.dashAt(time, body);
      const total = lapTrails.pathLengths[body] ?? 0;
      trail.setAttribute(
        "stroke-dasharray",
        `${String(length)} ${String(Math.max(0, total - length))}`,
      );
      trail.setAttribute("stroke-dashoffset", String(-offset));
    } else {
      trail.setAttribute(
        "d",
        pathData(motion.trailAt(time, body), fourDecimals),
      );
    }
  });
}

/**
 * Keeps the trails `TRAIL_WIDTH_PX` wide on screen. Dashed trails cannot use
 * vector-effect: non-scaling-stroke, which makes browsers measure the dashes
 * in screen pixels instead of along the path, so their width goes in the
 * drawing's units, from the size the drawing is shown at.
 */
function useTrailWidth(
  drawingRef: RefObject<SVGSVGElement | null>,
  trailsRef: RefObject<SVGGElement | null>,
  frameSize: number,
  active: boolean,
) {
  useLayoutEffect(() => {
    const drawing = drawingRef.current;
    const trails = trailsRef.current;
    if (!active || !drawing || !trails) return;
    const fit = () => {
      const { width, height } = drawing.getBoundingClientRect();
      const shown = Math.min(width, height);
      if (shown > 0)
        trails.style.strokeWidth = String((TRAIL_WIDTH_PX * frameSize) / shown);
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(drawing);
    return () => {
      observer.disconnect();
    };
  }, [drawingRef, trailsRef, frameSize, active]);
}

/**
 * The three bodies moving along their paths, with their trails, at the
 * instant the clock owns; it redraws on each of the clock's ticks. The whole
 * paths and the trails can be hidden.
 */
export function BodiesDrawing({
  motion,
  paths,
  frame,
  trails,
  clock,
  showTrail,
  showPath,
  label,
}: {
  motion: Motion;
  /** A lap's trails as dashes along `paths`; without them, trails are rebuilt each frame. */
  trails?: LapTrails | undefined;
  /** SVG path data of each body's whole path. */
  paths: readonly string[];
  frame: Frame;
  clock: PlaybackClock;
  showTrail: boolean;
  showPath: boolean;
  /**
   * Accessible name of the drawing. It goes in ARIA rather than `<title>`,
   * which browsers show as a tooltip over the simulation. Without one the
   * drawing is decoration.
   */
  label?: string | undefined;
}): ReactElement {
  const drawingRef = useRef<SVGSVGElement>(null);
  const trailsRef = useRef<SVGGElement>(null);
  useTrailWidth(drawingRef, trailsRef, frame.size, trails !== undefined);

  useLayoutEffect(() => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    const parts = movingPartsOf(drawing);

    draw(motion, trails, clock.time(), parts);
    return clock.subscribe((time) => {
      draw(motion, trails, time, parts);
    });
  }, [motion, trails, clock]);

  return (
    <svg
      ref={drawingRef}
      className="block h-full w-full"
      viewBox={frame.viewBox}
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
    >
      <g style={{ display: showPath ? undefined : "none" }}>
        {BODY_INDICES.map((body) => (
          <path
            key={body}
            data-part="path"
            d={paths[body]}
            fill="none"
            strokeWidth={1}
            strokeOpacity={0.5}
            vectorEffect="non-scaling-stroke"
            style={{ stroke: BODY_COLORS[body] }}
          />
        ))}
      </g>
      <g ref={trailsRef} style={{ display: showTrail ? undefined : "none" }}>
        {BODY_INDICES.map((body) =>
          trails ? (
            <path
              key={body}
              data-part="trail"
              d={paths[body]}
              pathLength={trails.pathLengths[body]}
              fill="none"
              strokeOpacity={0.85}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ stroke: BODY_COLORS[body] }}
            />
          ) : (
            <path
              key={body}
              data-part="trail"
              fill="none"
              strokeWidth={TRAIL_WIDTH_PX}
              strokeOpacity={0.85}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ stroke: BODY_COLORS[body] }}
            />
          ),
        )}
      </g>
      {BODY_INDICES.map((body) => (
        <circle
          key={body}
          r={frame.bodyRadius}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          style={{ fill: BODY_COLORS[body], stroke: "var(--background)" }}
        />
      ))}
    </svg>
  );
}
