// The search for periodic orbits from a seed of the collinear scheme: the
// bodies start in line at (-1, 0), (1, 0) and (0, 0), the outer two with the
// velocity (vx, vy) and the middle one with minus twice it, the scheme of
// Šuvakov and Dmitrašinović and of Li and Liao. A seed is simulated to find
// the instant its bodies come back closest to where they started, and that
// return is closed, corrected until the state comes back to itself, as those
// authors did, with Levenberg-Marquardt.

import {
  derivativeOf,
  integrate,
  integrateTrajectory,
  LapError,
  stateOf,
  type Trajectory,
} from "./lap";
import {
  collinearStart,
  getSolution,
  SOLUTIONS,
  type Seed,
  type SolutionSlug,
} from "./solutions";

export type { Seed } from "./solutions";

/** The range of each component of a seed, which spans the catalogue's. */
export const SEED_LIMITS = { min: -1, max: 1 } as const;

/** The longest simulation of a seed, in simulation time units. */
export const MAX_TIME_LIMITS = { min: 5, max: 60 } as const;
export const DEFAULT_MAX_TIME = 30;

/**
 * Distance, in the twelve numbers of the state, that the bodies must move
 * away from the start before a return counts: right after t = 0 they are
 * still close to it without having gone anywhere.
 */
const DEPARTURE_DISTANCE = 0.5;

/** The state comes back to itself within this distance: the orbit is closed. */
export const CLOSED_ERROR = 1e-6;
const MAX_ITERATIONS = 40;
/** Step of the central differences for the derivatives with respect to the seed. */
const DIFFERENCE_STEP = 1e-5;
const INITIAL_DAMPING = 1e-3;
const DAMPING_FACTOR = 3;
/** Above this damping the corrections no longer reduce the error. */
const MAX_DAMPING = 1e10;
/** Shortest period a correction may reach. */
const MIN_PERIOD = 0.5;

/** The periods a closed orbit may have: what a correction reaches, up to the longest simulation. */
export const PERIOD_LIMITS = {
  min: MIN_PERIOD,
  max: MAX_TIME_LIMITS.max,
} as const;

function initialState(seed: Seed): Float64Array {
  const { positions, velocities } = collinearStart(seed);
  return stateOf(positions, velocities);
}

function distance(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    sum += difference * difference;
  }
  return Math.sqrt(sum);
}

/** The instant the bodies came back closest to the start, and how close. */
export interface Return {
  readonly time: number;
  readonly distance: number;
}

export type Simulation =
  | {
      readonly kind: "open";
      readonly trajectory: Trajectory;
      /** Absent when the bodies did not come back closer after moving away. */
      readonly bestReturn: Return | null;
    }
  | {
      readonly kind: "collision";
      /** The paths up to the instant the bodies collide, its `endTime`. */
      readonly trajectory: Trajectory;
    };

/**
 * A return counts as one of the closest within this factor of the closest:
 * the returns of a closed orbit after one lap and after two differ only by
 * the integration's error.
 */
const CLOSEST_RETURN_FACTOR = 2;

/**
 * The return between three steps around it, where the parabola through
 * their squared distances has its minimum. The steps are far apart where
 * the bodies move slowly: the step closest to the return can still be
 * farther from the start than the integration's error.
 */
function refinedReturn(a: Return, b: Return, c: Return): Return {
  const [ya, yb, yc] = [a, b, c].map(({ distance }) => distance * distance);
  const h1 = b.time - a.time;
  const h2 = c.time - b.time;
  const slope1 = ((yb ?? 0) - (ya ?? 0)) / h1;
  const slope2 = ((yc ?? 0) - (yb ?? 0)) / h2;
  const curvature = (slope2 - slope1) / (h1 + h2);
  if (!(curvature > 0)) return b;
  // y(t) = yb + s·(t − b) + curvature·(t − b)², with s the slope at b.
  const slope = slope1 + curvature * h1;
  const offset = Math.min(h2, Math.max(-h1, -slope / (2 * curvature)));
  const squared = (yb ?? 0) + slope * offset + curvature * offset * offset;
  return { time: b.time + offset, distance: Math.sqrt(Math.max(0, squared)) };
}

/** The earliest of the returns closest to the start, or null without any. */
function firstOfTheClosest(returns: readonly Return[]): Return | null {
  const closest = Math.min(...returns.map(({ distance }) => distance));
  return (
    returns.find(
      ({ distance }) => distance <= closest * CLOSEST_RETURN_FACTOR,
    ) ?? null
  );
}

/**
 * Simulates a seed up to `maxTime` and finds its best return: the earliest
 * of the closest. A seed whose bodies collide keeps its paths up to the
 * collision.
 */
export function simulateSeed(seed: Seed, maxTime: number): Simulation {
  const start = initialState(seed);
  let departed = false;
  const returns: Return[] = [];
  // The last two steps after departing: a return is a step closer to the
  // start than the steps on either side.
  let before: Return | null = null;
  let last: Return | null = null;
  const trajectory = integrateTrajectory(start, maxTime, (time, state) => {
    const current = { time, distance: distance(state, start) };
    if (!departed) {
      departed = current.distance > DEPARTURE_DISTANCE;
      return;
    }
    if (
      before !== null &&
      last !== null &&
      last.distance < before.distance &&
      last.distance <= current.distance
    )
      returns.push(refinedReturn(before, last, current));
    before = last;
    last = current;
  });
  if (trajectory.collided) return { kind: "collision", trajectory };
  return { kind: "open", trajectory, bestReturn: firstOfTheClosest(returns) };
}

/** A catalogue orbit that a closed seed reproduces. */
export interface KnownMatch {
  readonly slug: SolutionSlug;
  /** Laps of the catalogue orbit that the closed period spans. */
  readonly laps: number;
}

export type Closure =
  | {
      readonly kind: "closed";
      readonly seed: Seed;
      readonly period: number;
      /** Distance between the state at the period and at t = 0. */
      readonly error: number;
      readonly iterations: number;
      readonly knownMatch: KnownMatch | null;
    }
  | {
      readonly kind: "not-converged";
      /** The smallest distance the corrections reached. */
      readonly error: number;
      readonly iterations: number;
    }
  | { readonly kind: "collision" };

/** The state at `period`, and that state minus the one at t = 0. */
function residualWithEnd(
  seed: Seed,
  period: number,
): { end: Float64Array; residual: Float64Array } {
  const start = initialState(seed);
  const end = integrate(start, period);
  return { end, residual: end.map((value, i) => value - (start[i] ?? 0)) };
}

function residual(seed: Seed, period: number): Float64Array {
  return residualWithEnd(seed, period).residual;
}

function size(vector: Float64Array): number {
  return Math.sqrt(dot(vector, vector));
}

/** Solves the 3×3 system `matrix · x = vector` by Gaussian elimination. */
function solve3(
  matrix: readonly (readonly number[])[],
  vector: readonly number[],
): number[] | null {
  const rows = matrix.map((row, i) => [...row, vector[i] ?? 0]);
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let row = column + 1; row < 3; row++) {
      if (
        Math.abs(rows[row]?.[column] ?? 0) >
        Math.abs(rows[pivot]?.[column] ?? 0)
      )
        pivot = row;
    }
    const pivotRow = rows[pivot];
    const current = rows[column];
    if (!pivotRow || !current || Math.abs(pivotRow[column] ?? 0) < 1e-300)
      return null;
    rows[pivot] = current;
    rows[column] = pivotRow;
    for (let row = column + 1; row < 3; row++) {
      const target = rows[row];
      if (!target) continue;
      const factor = (target[column] ?? 0) / (pivotRow[column] ?? 1);
      for (let k = column; k < 4; k++)
        target[k] = (target[k] ?? 0) - factor * (pivotRow[k] ?? 0);
    }
  }
  const solution = [0, 0, 0];
  for (let row = 2; row >= 0; row--) {
    const current = rows[row] ?? [];
    let sum = current[3] ?? 0;
    for (let k = row + 1; k < 3; k++)
      sum -= (current[k] ?? 0) * (solution[k] ?? 0);
    solution[row] = sum / (current[row] ?? 1);
  }
  return solution;
}

/**
 * The derivatives of the residual with respect to vx, vy and the period, as
 * the three columns of its Jacobian. Those of the seed by central
 * differences; that of the period is exact: the state's own derivative.
 */
function jacobian(
  seed: Seed,
  period: number,
  end: Float64Array,
): Float64Array[] {
  const bySeed = (change: Seed) =>
    residual({ vx: seed.vx + change.vx, vy: seed.vy + change.vy }, period);
  const centered = (change: Seed) => {
    const forward = bySeed(change);
    const backward = bySeed({ vx: -change.vx, vy: -change.vy });
    return forward.map(
      (value, i) => (value - (backward[i] ?? 0)) / (2 * DIFFERENCE_STEP),
    );
  };
  return [
    centered({ vx: DIFFERENCE_STEP, vy: 0 }),
    centered({ vx: 0, vy: DIFFERENCE_STEP }),
    derivativeOf(end),
  ];
}

function dot(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

/**
 * Corrects a seed and a period with Levenberg-Marquardt until the state at
 * the period comes back to the one at t = 0 within CLOSED_ERROR.
 */
export function closeOrbit(seed: Seed, period: number): Closure {
  try {
    let current = { seed, period };
    let { end, residual: r } = residualWithEnd(seed, period);
    let error = size(r);
    let damping = INITIAL_DAMPING;
    let iterations = 0;
    while (error >= CLOSED_ERROR) {
      if (iterations >= MAX_ITERATIONS || damping > MAX_DAMPING)
        return { kind: "not-converged", error, iterations };
      iterations += 1;
      const columns = jacobian(current.seed, current.period, end);
      const normal = columns.map((a) => columns.map((b) => dot(a, b)));
      const gradient = columns.map((column) => -dot(column, r));
      let improved = false;
      while (!improved && damping <= MAX_DAMPING) {
        const damped = normal.map((row, i) =>
          row.map((value, j) => (i === j ? value * (1 + damping) : value)),
        );
        const step = solve3(damped, gradient);
        if (!step) {
          damping *= DAMPING_FACTOR;
          continue;
        }
        const candidate = {
          seed: {
            vx: current.seed.vx + (step[0] ?? 0),
            vy: current.seed.vy + (step[1] ?? 0),
          },
          period: current.period + (step[2] ?? 0),
        };
        const evaluated =
          candidate.period < MIN_PERIOD
            ? null
            : tryResidual(candidate.seed, candidate.period);
        if (evaluated && size(evaluated.residual) < error) {
          current = candidate;
          ({ end, residual: r } = evaluated);
          error = size(r);
          damping /= DAMPING_FACTOR;
          improved = true;
        } else {
          damping *= DAMPING_FACTOR;
        }
      }
    }
    return {
      kind: "closed",
      seed: current.seed,
      period: current.period,
      error,
      iterations,
      knownMatch: knownMatchOf(current.seed, current.period),
    };
  } catch (error) {
    if (error instanceof LapError) return { kind: "collision" };
    throw error;
  }
}

/** The residual and its end state, or null when the bodies collide on the way. */
function tryResidual(
  seed: Seed,
  period: number,
): ReturnType<typeof residualWithEnd> | null {
  try {
    return residualWithEnd(seed, period);
  } catch (error) {
    if (error instanceof LapError) return null;
    throw error;
  }
}

const SEED_MATCH = 1e-4;
const LAPS_MATCH = 1e-3;

/**
 * The catalogue orbit a closed seed reproduces, if any. A seed with either
 * component's sign changed draws the same orbit, mirrored on the x axis or
 * run backwards in time, so it counts as the same one.
 */
export function knownMatchOf(seed: Seed, period: number): KnownMatch | null {
  for (const solution of SOLUTIONS) {
    if (solution.start.scheme !== "collinear") continue;
    const { vx, vy } = solution.start.seed;
    const sameSeed =
      Math.abs(Math.abs(seed.vx) - Math.abs(vx)) < SEED_MATCH &&
      Math.abs(Math.abs(seed.vy) - Math.abs(vy)) < SEED_MATCH;
    const laps = Math.round(period / solution.period);
    if (
      sameSeed &&
      laps >= 1 &&
      Math.abs(period / solution.period - laps) < LAPS_MATCH
    )
      return { slug: solution.slug, laps };
  }
  return null;
}

/** The seed of a catalogue orbit of the collinear scheme, or null for Lagrange. */
export function seedOf(slug: SolutionSlug): Seed | null {
  const { start } = getSolution(slug);
  return start.scheme === "collinear" ? start.seed : null;
}
