// A lap's trails as dashes along its closed paths: the trail of a body is
// the stretch of its path it travelled in the last TRAIL_LENGTH, so a drawing
// can stroke it over the path already drawn with stroke-dasharray, instead of
// rebuilding the trail's path data every frame.

import type { CubicCurve, CurvePath, Lap } from "./lap";
import { TRAIL_LENGTH } from "./playback-config";
import { BODY_INDICES, type BodyIndex, type Vector2 } from "./solutions";

/** Chords per curve when measuring it: the steps are short, so few suffice. */
const CHORDS_PER_CURVE = 8;

/** Where a trail lies along its body's path, in units of the path's length. */
export interface TrailDash {
  /** Distance along the path from its start to the trail's tail. */
  readonly offset: number;
  /** Distance along the path from the tail to the body. */
  readonly length: number;
}

export interface LapTrails {
  /**
   * Length of each body's closed path, as `pathOf` draws it: the unit of
   * `dashAt`, to give each SVG path as its pathLength.
   */
  readonly pathLengths: readonly number[];
  dashAt(simulationTime: number, body: BodyIndex): TrailDash;
}

function pointOnCurve(from: Vector2, curve: CubicCurve, t: number): Vector2 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * from[0] +
      b * curve.control1[0] +
      c * curve.control2[0] +
      d * curve.end[0],
    a * from[1] +
      b * curve.control1[1] +
      c * curve.control2[1] +
      d * curve.end[1],
  ];
}

function curveLength(from: Vector2, curve: CubicCurve): number {
  let length = 0;
  let previous = from;
  for (let chord = 1; chord <= CHORDS_PER_CURVE; chord++) {
    const point = pointOnCurve(from, curve, chord / CHORDS_PER_CURVE);
    length += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    previous = point;
  }
  return length;
}

/** Distance along the path to the end of each curve, starting with 0. */
function cumulativeLengths({ start, curves }: CurvePath): Float64Array {
  const lengths = new Float64Array(curves.length + 1);
  let from = start;
  curves.forEach((curve, i) => {
    lengths[i + 1] = (lengths[i] ?? 0) + curveLength(from, curve);
    from = curve.end;
  });
  return lengths;
}

/** The last index whose value is at most `value`, in an increasing array. */
function lastAtOrBefore(values: Float64Array, value: number): number {
  let low = 0;
  let high = values.length - 2;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((values[middle] ?? 0) <= value) low = middle;
    else high = middle - 1;
  }
  return low;
}

/**
 * The trails of a lap as dashes. Each curve of `pathOf` spans one step, so
 * an instant within a step lies that share of the way along its curve.
 */
export function lapTrails(lap: Lap): LapTrails {
  const { period, stepCount } = lap;
  const times = Float64Array.from({ length: stepCount + 1 }, (_, step) =>
    step === stepCount ? period : lap.step(step).time,
  );
  const lengths = BODY_INDICES.map((body) =>
    cumulativeLengths(lap.pathOf(body)),
  );
  const pathLengths = lengths.map((each) => each[stepCount] ?? 0);

  const distanceAt = (simulationTime: number, body: BodyIndex): number => {
    const lapTime = ((simulationTime % period) + period) % period;
    const step = lastAtOrBefore(times, lapTime);
    const from = times[step] ?? 0;
    const to = times[step + 1] ?? period;
    const share = to > from ? (lapTime - from) / (to - from) : 0;
    const along = lengths[body];
    const before = along?.[step] ?? 0;
    return before + share * ((along?.[step + 1] ?? before) - before);
  };

  return {
    pathLengths,
    dashAt: (simulationTime, body) => {
      const total = pathLengths[body] ?? 0;
      if (TRAIL_LENGTH >= period) return { offset: 0, length: total };
      const offset = distanceAt(simulationTime - TRAIL_LENGTH, body);
      const end = distanceAt(simulationTime, body);
      return {
        offset,
        length: end >= offset ? end - offset : end + total - offset,
      };
    },
  };
}
