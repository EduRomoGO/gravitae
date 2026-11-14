import { MAX_TRAIL_POINTS, TRAIL_LENGTH } from "./playback-config";
import {
  BODY_INDICES,
  type BodyIndex,
  type InitialConditions,
  type PerBody,
  type Vector2,
} from "./solutions";

// The layout of a step's state lives only in this module: the integrator
// writes it, and the Lap and `motionOf` read it. A Trajectory carries its flat
// arrays across the search worker's postMessage, which clones data but not
// functions, under a type this module does not export.
const BODIES = BODY_INDICES.length;
/** Numbers per stored sample: x1, y1, x2, y2, x3, y3. */
const POSITION_COMPONENTS = BODIES * 2;
/** Positions first (x1, y1, x2, y2, x3, y3), then velocities in the same order. */
const STATE_SIZE = POSITION_COMPONENTS * 2;

const TOLERANCE = 1e-10;
const INITIAL_STEP = 1e-3;
const SAFETY_FACTOR = 0.9;
const MIN_STEP_GROWTH = 0.2;
const MAX_STEP_GROWTH = 5;
/** The error estimate of a Dormand-Prince 5(4) step scales with h^5. */
const STEP_GROWTH_EXPONENT = -1 / 5;
const SMALLEST_ERROR = 1e-16;
/**
 * Below this step the bodies are colliding. The catalog's smallest step is
 * about 1.6e-5, four orders of magnitude above it.
 */
const MIN_STEP = 1e-9;
/**
 * Accepted steps a lap may take, which bounds both the time spent and the
 * memory the lap holds. The catalog's longest lap takes 4579.
 */
const MAX_STEPS = 200_000;

// Dormand-Prince 5(4) coefficients. The last row of the matrix equals the
// fifth-order weights, so the last stage is evaluated at the new state.
const STAGE_MATRIX: readonly (readonly number[])[] = [
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];
const STAGES = STAGE_MATRIX.length + 1;

/** Fifth-order weights minus fourth-order weights. */
const ERROR_WEIGHTS: readonly number[] = [
  35 / 384 - 5179 / 57600,
  0,
  500 / 1113 - 7571 / 16695,
  125 / 192 - 393 / 640,
  -2187 / 6784 + 92097 / 339200,
  11 / 84 - 187 / 2100,
  -1 / 40,
];

/**
 * Reads an index that the surrounding loop already bounds, which
 * `noUncheckedIndexedAccess` cannot see.
 */
function at(values: ArrayLike<number>, index: number): number {
  return values[index] ?? 0;
}

/** Writes the time derivative of `state` into `out`, with G = 1 and masses of 1. */
function derivative(state: Float64Array, out: Float64Array, offset: number) {
  for (let i = 0; i < POSITION_COMPONENTS; i++) {
    out[offset + i] = at(state, POSITION_COMPONENTS + i);
    out[offset + POSITION_COMPONENTS + i] = 0;
  }
  const accelerationStart = offset + POSITION_COMPONENTS;
  for (let a = 0; a < BODIES; a++) {
    for (let b = a + 1; b < BODIES; b++) {
      const dx = at(state, 2 * b) - at(state, 2 * a);
      const dy = at(state, 2 * b + 1) - at(state, 2 * a + 1);
      const distanceSquared = dx * dx + dy * dy;
      const scale = 1 / (distanceSquared * Math.sqrt(distanceSquared));
      out[accelerationStart + 2 * a] =
        at(out, accelerationStart + 2 * a) + dx * scale;
      out[accelerationStart + 2 * a + 1] =
        at(out, accelerationStart + 2 * a + 1) + dy * scale;
      out[accelerationStart + 2 * b] =
        at(out, accelerationStart + 2 * b) - dx * scale;
      out[accelerationStart + 2 * b + 1] =
        at(out, accelerationStart + 2 * b + 1) - dy * scale;
    }
  }
}

function vectorsFrom(state: Float64Array, start: number): PerBody {
  const body = (index: BodyIndex): Vector2 => [
    at(state, start + 2 * index),
    at(state, start + 2 * index + 1),
  ];
  return [body(0), body(1), body(2)];
}

function positionsOf(state: Float64Array): PerBody {
  return vectorsFrom(state, 0);
}

function velocitiesOf(state: Float64Array): PerBody {
  return vectorsFrom(state, POSITION_COMPONENTS);
}

export type IntegrationRequest = InitialConditions & {
  /** Time at which the integration stops, reached exactly. */
  readonly period: number;
};

/** A body at an instant. Its velocity is what makes the curve through it smooth. */
interface Knot {
  readonly time: number;
  readonly position: Vector2;
  readonly velocity: Vector2;
}

/** Cubic Hermite position and velocity on one axis, a fraction through a step. */
function hermite(
  from: number,
  fromVelocity: number,
  to: number,
  toVelocity: number,
  duration: number,
  fraction: number,
): [position: number, velocity: number] {
  const s = fraction;
  const s2 = s * s;
  const s3 = s2 * s;
  return [
    (2 * s3 - 3 * s2 + 1) * from +
      (s3 - 2 * s2 + s) * duration * fromVelocity +
      (-2 * s3 + 3 * s2) * to +
      (s3 - s2) * duration * toVelocity,
    ((6 * s2 - 6 * s) * (from - to)) / duration +
      (3 * s2 - 4 * s + 1) * fromVelocity +
      (3 * s2 - 2 * s) * toVelocity,
  ];
}

export interface CubicCurve {
  readonly control1: Vector2;
  readonly control2: Vector2;
  readonly end: Vector2;
}

/** A line made of cubic Bézier curves, each starting where the previous ended. */
export interface CurvePath {
  readonly start: Vector2;
  readonly curves: readonly CubicCurve[];
}

/** The Bézier curve equal to the Hermite curve between two knots. */
function curveBetween(from: Knot, to: Knot): CubicCurve {
  const third = (to.time - from.time) / 3;
  return {
    control1: [
      from.position[0] + third * from.velocity[0],
      from.position[1] + third * from.velocity[1],
    ],
    control2: [
      to.position[0] - third * to.velocity[0],
      to.position[1] - third * to.velocity[1],
    ],
    end: to.position,
  };
}

function pathThrough(knots: readonly Knot[]): CurvePath {
  const [first] = knots;
  const curves: CubicCurve[] = [];
  knots.slice(1).forEach((knot, index) => {
    const previous = knots[index];
    if (previous) curves.push(curveBetween(previous, knot));
  });
  return { start: first?.position ?? [0, 0], curves };
}

/** The last index up to `last` whose time is no later than `time`, by binary search. */
function lastAtOrBefore(
  times: Float64Array,
  last: number,
  time: number,
): number {
  let low = 0;
  let high = last;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (at(times, middle) <= time) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** A body's knot at `time`, between the knots that start and end its step. */
function knotBetween(from: Knot, to: Knot, time: number): Knot {
  const duration = to.time - from.time;
  if (!(duration > 0)) return { ...from, time };
  const fraction = (time - from.time) / duration;
  const axis = (index: 0 | 1) =>
    hermite(
      from.position[index],
      from.velocity[index],
      to.position[index],
      to.velocity[index],
      duration,
      fraction,
    );
  const [x, velocityX] = axis(0);
  const [y, velocityY] = axis(1);
  return { time, position: [x, y], velocity: [velocityX, velocityY] };
}

/** One body's knot from the stored state at `index`. */
function knotOfState(
  states: Float64Array,
  index: number,
  time: number,
  body: BodyIndex,
): Knot {
  const offset = index * STATE_SIZE + 2 * body;
  const value = (component: number) => at(states, offset + component);
  return {
    time,
    position: [value(0), value(1)],
    velocity: [value(POSITION_COMPONENTS), value(POSITION_COMPONENTS + 1)],
  };
}

/** The state of the three bodies at the instant a step starts. */
export type LapStep = InitialConditions & { readonly time: number };

/**
 * Bodies moving in time, as a drawing reads them: where each body is at an
 * instant and the trail it leaves behind.
 */
export interface Motion {
  /** Position of each body at an instant, interpolated within its step. */
  positionsAt(simulationTime: number): PerBody;
  /** One body's trail, up to one trail length long, ending at the body. */
  trailAt(simulationTime: number, body: BodyIndex): CurvePath;
}

/**
 * One body's trail through the steps `firstInside` to `lastInside`, between
 * the knots at its two ends. The steps bunch up where the curve bends most,
 * so keeping one of every `stride` keeps the detail there while bounding the
 * work done per frame.
 */
function trailThrough(
  start: Knot,
  end: Knot,
  firstInside: number,
  lastInside: number,
  knotAt: (step: number) => Knot,
): CurvePath {
  const inside = lastInside - firstInside + 1;
  const stride = Math.max(1, Math.ceil(inside / (MAX_TRAIL_POINTS - 2)));
  const knots = [start];
  for (let step = firstInside; step <= lastInside; step += stride) {
    knots.push(knotAt(step));
  }
  knots.push(end);
  return pathThrough(knots);
}

/**
 * One calculated lap of a solution. It owns the layout of its samples; the
 * rest of the app reads positions, paths and trails through its functions.
 * Its motion repeats every period.
 */
export interface Lap extends Motion {
  /** Duration of the lap, in simulation time units. */
  readonly period: number;
  /** Number of accepted steps in the lap. */
  readonly stepCount: number;
  /** Positions at t = period. Not stored as a step: they repeat those at t = 0. */
  readonly finalPositions: PerBody;
  /**
   * The state where step `index` starts. The index may fall outside the lap:
   * the laps repeat, so step `stepCount` is step 0 of the next lap, one period
   * later.
   */
  step(index: number): LapStep;
  /** The whole lap of one body, closed at the point where it started. */
  pathOf(body: BodyIndex): CurvePath;
}

/**
 * @param times Instant at which each step starts, followed by the period.
 * @param states STATE_SIZE numbers per step, laid out as described at STATE_SIZE.
 */
function createLap(
  period: number,
  times: Float64Array,
  states: Float64Array,
  finalPositions: PerBody,
): Lap {
  const stepCount = times.length - 1;

  /** Wraps a step index into the lap, and the time where that step starts. */
  const wrap = (index: number): { step: number; time: number } => {
    const step = ((index % stepCount) + stepCount) % stepCount;
    return {
      step,
      time: at(times, step) + ((index - step) / stepCount) * period,
    };
  };

  const lapTimeOf = (simulationTime: number): number =>
    ((simulationTime % period) + period) % period;

  /** The last step that starts no later than `lapTime`. */
  const stepAt = (lapTime: number): number =>
    lastAtOrBefore(times, stepCount - 1, lapTime);

  /**
   * One body's knot where step `index` starts, with the same wrapping as
   * `step`. It reads only that body's numbers: trails call it every frame.
   */
  const knotAt = (index: number, body: BodyIndex): Knot => {
    const { step, time } = wrap(index);
    return knotOfState(states, step, time, body);
  };

  /** The knot of a body at any instant, interpolated within its step. */
  const knotOfInstant = (simulationTime: number, body: BodyIndex): Knot => {
    const lapTime = lapTimeOf(simulationTime);
    const step = stepAt(lapTime);
    return {
      ...knotBetween(knotAt(step, body), knotAt(step + 1, body), lapTime),
      time: simulationTime,
    };
  };

  return {
    period,
    stepCount,
    finalPositions,

    step: (index) => {
      const { step, time } = wrap(index);
      const state = states.subarray(step * STATE_SIZE, (step + 1) * STATE_SIZE);
      return {
        time,
        positions: positionsOf(state),
        velocities: velocitiesOf(state),
      };
    },

    positionsAt: (simulationTime) => [
      knotOfInstant(simulationTime, 0).position,
      knotOfInstant(simulationTime, 1).position,
      knotOfInstant(simulationTime, 2).position,
    ],

    pathOf: (body) =>
      pathThrough(
        Array.from({ length: stepCount + 1 }, (_, step) => knotAt(step, body)),
      ),

    trailAt: (simulationTime, body) => {
      const end = lapTimeOf(simulationTime);
      const start = end - TRAIL_LENGTH;
      const startStep = stepAt(lapTimeOf(start));
      const endStep = stepAt(end);
      // A trail that starts in the previous lap counts its steps back from this one.
      const firstInside = startStep + 1 - (start < 0 ? stepCount : 0);
      const lastInside = times[endStep] === end ? endStep - 1 : endStep;
      return trailThrough(
        knotOfInstant(start, body),
        knotOfInstant(end, body),
        firstInside,
        lastInside,
        (step) => knotAt(step, body),
      );
    },
  };
}

/**
 * A lap through the given steps, in order from t = 0. The lap closes at the
 * first step, one period later.
 *
 * Only the tests use it, to build laps worked by hand. It lives here because
 * this module is the only one that knows the layout of the steps' state.
 */
export function lapThrough(period: number, steps: readonly LapStep[]): Lap {
  const [first] = steps;
  if (!first) throw new Error("A lap needs at least one step.");
  return createLap(
    period,
    Float64Array.from([...steps.map(({ time }) => time), period]),
    Float64Array.from(
      steps.flatMap(({ positions, velocities }) => [
        ...positions.flat(),
        ...velocities.flat(),
      ]),
    ),
    first.positions,
  );
}

/** Thrown when the integrator cannot reach the end of the lap. */
export class LapError extends Error {
  constructor(reason: string) {
    super(`Cannot complete the lap: ${reason}`);
    this.name = "LapError";
  }
}

/**
 * Integrates the state from t = 0 to `endTime`, reached exactly, with an
 * adaptive Dormand-Prince 5(4) stepper. `onStep` sees every accepted step's
 * end, the last one included, with a state it must copy to keep. Returns the
 * state at `endTime`. Throws a `LapError` when the end cannot be reached, for
 * instance when two bodies collide, instead of looping forever.
 */
export function integrate(
  initial: Float64Array,
  endTime: number,
  onStep: (time: number, state: Float64Array) => void = () => undefined,
): Float64Array {
  const state = Float64Array.from(initial);
  const candidate = new Float64Array(STATE_SIZE);
  const slopes = new Float64Array(STAGES * STATE_SIZE);
  let time = 0;
  let step = INITIAL_STEP;
  let accepted = 0;

  while (time < endTime) {
    const clipped = step >= endTime - time;
    const size = clipped ? endTime - time : step;
    // The step that lands on the end may be short without meaning anything.
    if (!clipped && step < MIN_STEP) {
      throw new LapError(
        `the step at t = ${String(time)} fell below the minimum of ${String(MIN_STEP)}; two bodies probably collided.`,
      );
    }

    derivative(state, slopes, 0);
    for (const [stage, weights] of STAGE_MATRIX.entries()) {
      for (let i = 0; i < STATE_SIZE; i++) {
        let value = at(state, i);
        for (const [previous, weight] of weights.entries()) {
          value += size * weight * at(slopes, previous * STATE_SIZE + i);
        }
        candidate[i] = value;
      }
      derivative(candidate, slopes, (stage + 1) * STATE_SIZE);
    }

    let error = 0;
    for (let i = 0; i < STATE_SIZE; i++) {
      let estimate = 0;
      for (const [stage, weight] of ERROR_WEIGHTS.entries()) {
        estimate += weight * at(slopes, stage * STATE_SIZE + i);
      }
      const scale =
        TOLERANCE +
        TOLERANCE *
          Math.max(Math.abs(at(state, i)), Math.abs(at(candidate, i)));
      error = Math.max(error, Math.abs(estimate * size) / scale);
    }

    if (!Number.isFinite(error) || !Number.isFinite(size)) {
      throw new LapError(
        `the step or its error estimate at t = ${String(time)} is not finite; two bodies probably collided.`,
      );
    }

    const growth = Math.min(
      MAX_STEP_GROWTH,
      Math.max(
        MIN_STEP_GROWTH,
        SAFETY_FACTOR *
          Math.pow(Math.max(error, SMALLEST_ERROR), STEP_GROWTH_EXPONENT),
      ),
    );
    if (error <= 1) {
      state.set(candidate);
      time = clipped ? endTime : time + size;
      accepted += 1;
      if (time < endTime && accepted >= MAX_STEPS) {
        throw new LapError(
          `the integration reached t = ${String(time)} of ${String(endTime)} with the maximum of ${String(MAX_STEPS)} steps.`,
        );
      }
      onStep(time, state);
      // A clipped step says nothing about the size the error allows.
      if (!clipped) step = size * growth;
    } else {
      step = size * growth;
    }
  }
  return state;
}

/** The state of the bodies as `integrate` takes it: positions, then velocities. */
export function stateOf(positions: PerBody, velocities: PerBody): Float64Array {
  return Float64Array.from([...positions.flat(), ...velocities.flat()]);
}

/** The time derivative of a state, with G = 1 and masses of 1. */
export function derivativeOf(state: Float64Array): Float64Array {
  const out = new Float64Array(STATE_SIZE);
  derivative(state, out, 0);
  return out;
}

/** The accepted steps of a lap, read only by `lapOf`. */
interface LapSamples {
  /** Instant at which each step starts, followed by the period. */
  readonly times: Float64Array;
  /** STATE_SIZE numbers per step, laid out as described at STATE_SIZE. */
  readonly states: Float64Array;
}

/**
 * One calculated lap as plain data, so it crosses a postMessage: the search's
 * worker sends the lap it closed. `lapOf` makes it a `Lap`.
 */
export interface LapData {
  readonly period: number;
  readonly samples: LapSamples;
  readonly finalPositions: PerBody;
}

/** The lap the data describes; it does no integration. */
export function lapOf({
  period,
  samples: { times, states },
  finalPositions,
}: LapData): Lap {
  return createLap(period, times, states, finalPositions);
}

/** Integrates one lap into plain data. Throws a `LapError` when it cannot be completed. */
export function integrateLapData(request: IntegrationRequest): LapData {
  const initial = stateOf(request.positions, request.velocities);
  const { period } = request;
  const times = [0];
  const states = Array.from(initial);
  const final = integrate(initial, period, (time, state) => {
    times.push(time);
    // The state at t = period repeats the one at t = 0 and is not stored.
    if (time < period) states.push(...state);
  });

  return {
    period,
    samples: {
      times: Float64Array.from(times),
      states: Float64Array.from(states),
    },
    finalPositions: positionsOf(final),
  };
}

/** Integrates one lap. Throws a `LapError` when it cannot be completed. */
export function integrateLap(request: IntegrationRequest): Lap {
  return lapOf(integrateLapData(request));
}

/** The accepted steps of a trajectory, read only by `motionOf`. */
interface TrajectorySamples {
  /** Instant of each accepted step's end, from t = 0 to the trajectory's end. */
  readonly times: Float64Array;
  /** The state at each of `times`, laid out as described at STATE_SIZE. */
  readonly states: Float64Array;
}

/**
 * The bodies' paths from t = 0 up to an instant, open where they ended. It is
 * plain data, so it crosses a postMessage; `motionOf` makes it move.
 */
export interface Trajectory {
  /** Instant the paths reach, in simulation time units. */
  readonly endTime: number;
  /** One path per body, in the order body 1, body 2, body 3. */
  readonly paths: readonly CurvePath[];
  /** What `motionOf` interpolates the bodies' positions and trails from. */
  readonly samples: TrajectorySamples;
  /**
   * True when the integration stopped before the requested end because two
   * bodies collided; `endTime` is then the last instant reached.
   */
  readonly collided: boolean;
}

/**
 * Integrates from t = 0 to `endTime` and keeps every accepted step. When two
 * bodies collide on the way, the trajectory ends at the last step reached
 * and says so, instead of throwing. `onStep` sees each step as `integrate`
 * gives it.
 */
export function integrateTrajectory(
  initial: Float64Array,
  endTime: number,
  onStep: (time: number, state: Float64Array) => void = () => undefined,
): Trajectory {
  const times = [0];
  const states = Array.from(initial);
  let collided = false;
  try {
    integrate(initial, endTime, (time, state) => {
      times.push(time);
      states.push(...state);
      onStep(time, state);
    });
  } catch (error) {
    if (!(error instanceof LapError)) throw error;
    collided = true;
  }
  const storedTimes = Float64Array.from(times);
  const storedStates = Float64Array.from(states);
  const paths = BODY_INDICES.map((body) =>
    pathThrough(
      times.map((time, index) => knotOfState(storedStates, index, time, body)),
    ),
  );
  return {
    endTime: at(storedTimes, storedTimes.length - 1),
    paths,
    samples: { times: storedTimes, states: storedStates },
    collided,
  };
}

/**
 * A trajectory played once from t = 0 to its end, with nothing before or
 * after it: an instant outside it shows the bodies where they started or
 * where they stopped.
 */
export interface OpenMotion extends Motion {
  readonly endTime: number;
}

export function motionOf({
  samples: { times, states },
  endTime,
}: Trajectory): OpenMotion {
  const last = times.length - 1;
  const clamp = (time: number) => Math.min(endTime, Math.max(0, time));
  const knotAt = (index: number, body: BodyIndex) =>
    knotOfState(states, index, at(times, index), body);
  const knotOfInstant = (time: number, body: BodyIndex): Knot => {
    const step = lastAtOrBefore(times, Math.max(0, last - 1), time);
    return last === 0
      ? knotAt(0, body)
      : knotBetween(knotAt(step, body), knotAt(step + 1, body), time);
  };
  return {
    endTime,
    positionsAt: (simulationTime) => {
      const time = clamp(simulationTime);
      return [
        knotOfInstant(time, 0).position,
        knotOfInstant(time, 1).position,
        knotOfInstant(time, 2).position,
      ];
    },
    trailAt: (simulationTime, body) => {
      const end = clamp(simulationTime);
      // The trail starts at t = 0 at the latest, instead of wrapping to the end.
      const start = Math.max(0, end - TRAIL_LENGTH);
      if (end === start) return pathThrough([knotOfInstant(start, body)]);
      const lastAtEnd = lastAtOrBefore(times, last, end);
      return trailThrough(
        knotOfInstant(start, body),
        knotOfInstant(end, body),
        lastAtOrBefore(times, last, start) + 1,
        at(times, lastAtEnd) === end ? lastAtEnd - 1 : lastAtEnd,
        (step) => knotAt(step, body),
      );
    },
  };
}
