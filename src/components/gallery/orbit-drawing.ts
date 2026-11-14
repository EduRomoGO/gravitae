// The geometry shared by every drawing of bodies' paths: the SVG path data of
// a curve and the square frame that fits the paths.

import type { CurvePath } from "@/lib/orbits/lap";
import type { Vector2 } from "@/lib/orbits/solutions";

/** Empty margin around the orbit, as a fraction of its largest dimension. */
const MARGIN = 0.1;
/** Radius of a body, as a fraction of the orbit's largest dimension. */
const BODY_RADIUS = 0.028;

export type CoordinateFormat = (coordinate: number) => string;

/** SVG path data; SVG's y axis points down, the orbit's points up. */
export function pathData(
  { start, curves }: CurvePath,
  format: CoordinateFormat,
): string {
  const point = ([x, y]: Vector2) => `${format(x)},${format(-y)}`;
  const segments = curves.map(
    ({ control1, control2, end }) =>
      `C${point(control1)} ${point(control2)} ${point(end)}`,
  );
  return `M${point(start)}${segments.join("")}`;
}

export const fourDecimals: CoordinateFormat = (coordinate) =>
  coordinate.toFixed(4);

/** The square that fits the paths, in SVG coordinates, and a body's radius in it. */
export interface Frame {
  readonly viewBox: string;
  /** Side of the square, in the drawing's units. */
  readonly size: number;
  readonly bodyRadius: number;
}

export function frameOf(paths: readonly CurvePath[]): Frame {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const { start, curves } of paths) {
    for (const [x, y] of [start, ...curves.map(({ end }) => end)]) {
      xs.push(x);
      ys.push(-y);
    }
  }
  const minX = xs.reduce((a, b) => Math.min(a, b));
  const maxX = xs.reduce((a, b) => Math.max(a, b));
  const minY = ys.reduce((a, b) => Math.min(a, b));
  const maxY = ys.reduce((a, b) => Math.max(a, b));
  const orbitSize = Math.max(maxX - minX, maxY - minY);
  const size = orbitSize * (1 + 2 * MARGIN);
  const left = (minX + maxX - size) / 2;
  const top = (minY + maxY - size) / 2;
  return {
    viewBox: [left, top, size, size].map(String).join(" "),
    size,
    bodyRadius: orbitSize * BODY_RADIUS,
  };
}
