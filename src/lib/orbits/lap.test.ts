import { describe, expect, it } from "vitest";
import {
  integrateLap,
  integrateTrajectory,
  lapThrough,
  motionOf,
  stateOf,
  type Lap,
} from "./lap";
import { advanceTime } from "./playback";
import {
  MAX_TRAIL_POINTS,
  TIME_UNITS_PER_SECOND,
  TRAIL_LENGTH,
} from "./playback-config";
import {
  BODY_INDICES,
  collinearStart,
  getSolution,
  SOLUTIONS,
  type SolutionSlug,
} from "./solutions";

const CLOSURE_TOLERANCE = 1e-6;

describe("integrateLap", () => {
  it.each(SOLUTIONS.map((solution) => [solution.slug, solution] as const))(
    "brings every body of %s back to its start after one period",
    (_, solution) => {
      const { finalPositions } = integrateLap(solution);

      solution.positions.forEach(([startX, startY], body) => {
        const [x, y] = finalPositions[body] ?? [NaN, NaN];
        expect(Math.hypot(x - startX, y - startY)).toBeLessThan(
          CLOSURE_TOLERANCE,
        );
      });
    },
  );

  it.each([
    ["lagrange", 166],
    ["figura-de-ocho", 402],
    ["butterfly-i", 2740],
    ["goggles", 4579],
    ["moth-i", 1741],
    ["yin-yang-i", 2826],
  ] as const)(
    "keeps %s as a lap of %i steps from t = 0 up to t = T",
    (slug, steps) => {
      const solution = getSolution(slug);
      const lap = integrateLap(solution);

      expect(lap.stepCount).toBe(steps);
      expect(lap.period).toBe(solution.period);
      expect(lap.step(0)).toEqual({
        time: 0,
        positions: solution.positions,
        velocities: solution.velocities,
      });
      expect(lap.step(steps)).toEqual({
        time: solution.period,
        positions: solution.positions,
        velocities: solution.velocities,
      });
    },
  );

  it("takes short steps in the close approaches and long ones elsewhere", () => {
    const lap = integrateLap(getSolution("goggles"));
    const durations = Array.from(
      { length: lap.stepCount },
      (_, step) => lap.step(step + 1).time - lap.step(step).time,
    );

    expect(Math.min(...durations)).toBeLessThan(1e-3);
    expect(Math.max(...durations)).toBeGreaterThan(1e-2);
  });

  it("stores the analytic position and velocity of Lagrange at every step", () => {
    const period = 8.2691369013;
    const rate = (2 * Math.PI) / period;
    const lap = integrateLap(getSolution("lagrange"));

    // The analytic solution: an equilateral triangle rotating rigidly at 2π/T.
    for (let index = 0; index < lap.stepCount; index++) {
      const step = lap.step(index);
      const angle = rate * step.time;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const positions = [
        [-sin, cos],
        [-cos * 0.8660254038 + sin * 0.5, -sin * 0.8660254038 - cos * 0.5],
        [cos * 0.8660254038 + sin * 0.5, sin * 0.8660254038 - cos * 0.5],
      ];
      const velocities = [
        [-cos * rate, -sin * rate],
        [
          (sin * 0.8660254038 + cos * 0.5) * rate,
          (-cos * 0.8660254038 + sin * 0.5) * rate,
        ],
        [
          (-sin * 0.8660254038 + cos * 0.5) * rate,
          (cos * 0.8660254038 + sin * 0.5) * rate,
        ],
      ];
      const expected = [...positions, ...velocities].flat();
      const actual = [...step.positions, ...step.velocities].flat();
      expected.forEach((value, component) => {
        expect(Math.abs((actual[component] ?? NaN) - value)).toBeLessThan(
          CLOSURE_TOLERANCE,
        );
      });
    }
  });

  it("fails with a reason when two bodies start at the same point", () => {
    const calculate = () =>
      integrateLap({
        positions: [
          [0, 0],
          [0, 0],
          [1, 0],
        ],
        velocities: [
          [0, 1],
          [0, -1],
          [0, 0],
        ],
        period: 1,
      });

    expect(calculate).toThrow(/Cannot complete the lap: .*not finite/);
  });

  it("fails with a reason when two bodies at rest fall into each other", () => {
    const calculate = () =>
      integrateLap({
        positions: [
          [-0.5, 0],
          [0.5, 0],
          [0, 100],
        ],
        velocities: [
          [0, 0],
          [0, 0],
          [0, 0],
        ],
        period: 10,
      });

    expect(calculate).toThrow(/Cannot complete the lap: the step .* minimum/);
  });

  it("fails with a reason when the lap needs more steps than the maximum", () => {
    // Lagrange takes 166 steps per lap, so a million time units take millions.
    const calculate = () =>
      integrateLap({ ...getSolution("lagrange"), period: 1e6 });

    expect(calculate).toThrow(
      /Cannot complete the lap: .* maximum of \d+ steps/,
    );
    // Reaching the cap means integrating every one of its steps, which takes
    // seconds and exceeds the default timeout when the machine is busy.
  }, 60_000);
});

// Expressed through the constant so tuning the playback rate keeps these valid.
const secondsToReach = (time: number, speed: number) =>
  time / (speed * TIME_UNITS_PER_SECOND);

// Two steps of different duration. Worked by hand on the x of body 1, whose two
// arcs are parabolas: x = 4t - 8t² on [0, 0.5] and, with u = t - 0.5,
// x = -4u + (8/3)u² on [0.5, 2]. Its y goes 5 → 7 → 5 with zero velocity, so
// halfway through either step it is 6. Bodies 2 and 3 are the same at ×10 and
// ×100, so a wrong body or a wrong axis gives a different number.
const NODES = [
  [0, 0, 5, 4],
  [0.5, 0, 7, -4],
] as const;
const TWO_STEP_LAP: Lap = lapThrough(
  2,
  NODES.map(([time, x, y, vx]) => ({
    time,
    positions: [
      [x, y],
      [x * 10, y * 10],
      [x * 100, y * 100],
    ],
    velocities: [
      [vx, 0],
      [vx * 10, 0],
      [vx * 100, 0],
    ],
  })),
);

describe("lapThrough", () => {
  it("keeps the steps it is given and closes the lap at the first one", () => {
    expect(TWO_STEP_LAP.stepCount).toBe(2);
    expect(TWO_STEP_LAP.step(1).positions).toEqual([
      [0, 7],
      [0, 70],
      [0, 700],
    ]);
    expect(TWO_STEP_LAP.step(2).time).toBe(2);
    expect(TWO_STEP_LAP.finalPositions).toEqual([
      [0, 5],
      [0, 50],
      [0, 500],
    ]);
  });
});

describe("positionsAt", () => {
  it("returns the stored position at the instant a step starts", () => {
    expect(TWO_STEP_LAP.positionsAt(0.5)).toEqual([
      [0, 7],
      [0, 70],
      [0, 700],
    ]);
  });

  it("follows the curve within a short step, using the velocities", () => {
    expect(TWO_STEP_LAP.positionsAt(0.25)).toEqual([
      [0.5, 6],
      [5, 60],
      [50, 600],
    ]);
  });

  it("follows the curve within a long step, using its own duration", () => {
    expect(TWO_STEP_LAP.positionsAt(1.25)).toEqual([
      [-1.5, 6],
      [-15, 60],
      [-150, 600],
    ]);
  });

  it("advances continuously when 0.5x lands inside a step", () => {
    const first = advanceTime(0, secondsToReach(0.1, 0.5), 0.5);
    const second = advanceTime(0, secondsToReach(0.2, 0.5), 0.5);

    // x = 4t - 8t²
    expect(TWO_STEP_LAP.positionsAt(first)[0][0]).toBeCloseTo(0.32, 9);
    expect(TWO_STEP_LAP.positionsAt(second)[0][0]).toBeCloseTo(0.48, 9);
  });

  it("goes from the last step to the first with no repeated point at the seam", () => {
    const firstBody = [1.75, 2, 2.25, 4.25, -0.25].map(
      (time) => TWO_STEP_LAP.positionsAt(time)[0],
    );

    // Instant 1.75 is u = 1.25; -0.25 wraps to 1.75 as well.
    expect(firstBody[0]?.[0]).toBeCloseTo(-5 + (8 / 3) * 1.5625, 9);
    expect(firstBody[1]).toEqual([0, 5]);
    expect(firstBody[2]).toEqual([0.5, 6]);
    expect(firstBody[3]).toEqual([0.5, 6]);
    expect(firstBody[4]?.[0]).toBeCloseTo(-5 + (8 / 3) * 1.5625, 9);
  });
});

const STEPS = 480;

// Body 1 moves along x at speed 1 and body 2 at speed 10, so a point's x says
// the instant it belongs to; Hermite reproduces a straight line exactly.
const STRAIGHT_LAP: Lap = lapThrough(
  2,
  Array.from({ length: STEPS }, (_, step) => {
    const time = step / 240;
    return {
      time,
      positions: [
        [time, 0],
        [time * 10, 0],
        [0, 0],
      ],
      velocities: [
        [1, 0],
        [10, 0],
        [0, 0],
      ],
    };
  }),
);

describe("trailAt", () => {
  it("runs from one trail length behind the body up to the body", () => {
    const { start, curves } = STRAIGHT_LAP.trailAt(1, 0);

    expect(start[0]).toBeCloseTo(1 - TRAIL_LENGTH, 9);
    expect(curves.at(-1)?.end).toEqual(STRAIGHT_LAP.positionsAt(1)[0]);
  });

  it("belongs to the requested body", () => {
    const { start, curves } = STRAIGHT_LAP.trailAt(1, 1);

    expect(start[0]).toBeCloseTo((1 - TRAIL_LENGTH) * 10, 9);
    expect(curves.at(-1)?.end).toEqual(STRAIGHT_LAP.positionsAt(1)[1]);
  });

  it("continues from the end of the lap at the start of the lap", () => {
    expect(STRAIGHT_LAP.trailAt(0.5, 0).start[0]).toBeCloseTo(
      0.5 - TRAIL_LENGTH + STRAIGHT_LAP.period,
      9,
    );
  });

  it("joins the steps it crosses with curves that leave along the velocity", () => {
    // From t = 0.35 to t = 1.25, crossing the step at t = 0.5. Worked by hand on
    // the parabolas of TWO_STEP_LAP: a control point sits a third of the
    // curve's duration away from its end, along the velocity there.
    const { start, curves } = TWO_STEP_LAP.trailAt(1.25, 0);

    expect(start[0]).toBeCloseTo(0.42, 9);
    expect(curves).toHaveLength(2);
    expect(curves[0]?.control1[0]).toBeCloseTo(0.34, 9);
    expect(curves[0]?.control2[0]).toBeCloseTo(0.2, 9);
    expect(curves[0]?.end[0]).toBeCloseTo(0, 9);
    expect(curves[1]?.control1[0]).toBeCloseTo(-1, 9);
    expect(curves[1]?.control2[0]).toBeCloseTo(-1.5, 9);
    expect(curves[1]?.end[0]).toBeCloseTo(-1.5, 9);
  });

  it("never has more points than the limit when many steps fall inside", () => {
    expect(STRAIGHT_LAP.trailAt(1, 0).curves.length + 1).toBeLessThanOrEqual(
      MAX_TRAIL_POINTS,
    );
  });
});

describe("pathOf", () => {
  it("joins every step and closes the lap", () => {
    const { start, curves } = TWO_STEP_LAP.pathOf(0);

    expect(start).toEqual([0, 5]);
    expect(curves).toHaveLength(2);
    expect(curves[0]?.control1[0]).toBeCloseTo(2 / 3, 9);
    expect(curves[0]?.control2[0]).toBeCloseTo(2 / 3, 9);
    expect(curves[0]?.end).toEqual([0, 7]);
    expect(curves[1]?.control1[0]).toBeCloseTo(-2, 9);
    expect(curves[1]?.control2[0]).toBeCloseTo(-2, 9);
    expect(curves[1]?.end).toEqual([0, 5]);
  });

  it("takes only the index of one of the three bodies", () => {
    // @ts-expect-error -- there is no fourth body.
    expect(TWO_STEP_LAP.pathOf(3).curves).toHaveLength(2);
  });
});

// A difference below half a pixel cannot be seen in a 600 px drawing.
const VISIBLE_DIFFERENCE_PX = 0.5;
const DRAWING_PX = 600;
const DRAWN_FRACTION_OF_VIEW = 1 / 1.2;

function pixelsPerUnit(lap: Lap): number {
  const points = Array.from(
    { length: lap.stepCount },
    (_, step) => lap.step(step).positions,
  ).flat();
  const extent = (axis: 0 | 1) => {
    const values = points.map((point) => point[axis]);
    return Math.max(...values) - Math.min(...values);
  };
  return (DRAWING_PX * DRAWN_FRACTION_OF_VIEW) / Math.max(extent(0), extent(1));
}

describe("a calculated lap", () => {
  // Integrated once per solution: each integration takes a noticeable time.
  const laps = new Map<SolutionSlug, Lap>(
    SOLUTIONS.map((solution) => [solution.slug, integrateLap(solution)]),
  );
  const lapOf = (slug: SolutionSlug): Lap => {
    const lap = laps.get(slug);
    if (!lap) throw new Error(`No lap for ${slug}`);
    return lap;
  };

  it.each(SOLUTIONS.map(({ slug }) => slug))(
    "never has more trail points than the limit in %s",
    (slug) => {
      const lap = lapOf(slug);

      for (let instant = 0; instant < 500; instant++) {
        const time = (instant / 500) * lap.period;
        for (const body of BODY_INDICES) {
          expect(lap.trailAt(time, body).curves.length + 1).toBeLessThanOrEqual(
            MAX_TRAIL_POINTS,
          );
        }
      }
    },
  );

  it.each(SOLUTIONS.map(({ slug }) => slug))(
    "matches a direct integration halfway through every step of %s",
    (slug) => {
      const lap = lapOf(slug);
      const scale = pixelsPerUnit(lap);

      for (let index = 0; index < lap.stepCount; index++) {
        const step = lap.step(index);
        const halfDuration = (lap.step(index + 1).time - step.time) / 2;
        const direct = integrateLap({
          positions: step.positions,
          velocities: step.velocities,
          period: halfDuration,
        }).finalPositions;

        const played = lap.positionsAt(step.time + halfDuration);
        for (const body of [0, 1, 2] as const) {
          const [x, y] = played[body];
          const [directX, directY] = direct[body];
          expect(Math.hypot(x - directX, y - directY) * scale).toBeLessThan(
            VISIBLE_DIFFERENCE_PX,
          );
        }
      }
    },
  );
});

describe("integrateTrajectory", () => {
  it("ends at the last step reached when two bodies collide", () => {
    // At rest, the bodies fall straight into one another.
    const { positions, velocities } = collinearStart({ vx: 0, vy: 0 });
    const trajectory = integrateTrajectory(stateOf(positions, velocities), 10);

    expect(trajectory.collided).toBe(true);
    expect(trajectory.endTime).toBeLessThan(10);
    expect(trajectory.paths[0]?.curves.at(-1)?.end).toEqual(
      motionOf(trajectory).positionsAt(trajectory.endTime)[0],
    );
  });

  it("reaches the requested end when nothing collides", () => {
    const { positions, velocities } = getSolution("figura-de-ocho");
    const trajectory = integrateTrajectory(stateOf(positions, velocities), 2);

    expect(trajectory.collided).toBe(false);
    expect(trajectory.endTime).toBe(2);
  });
});

describe("motionOf", () => {
  const solution = getSolution("figura-de-ocho");
  const motion = motionOf(
    integrateTrajectory(
      stateOf(solution.positions, solution.velocities),
      solution.period,
    ),
  );
  const lap = integrateLap(solution);

  it("follows the bodies as the lap does", () => {
    const time = solution.period / 3;
    motion.positionsAt(time).forEach(([x, y], body) => {
      const [lapX, lapY] = lap.positionsAt(time)[body] ?? [NaN, NaN];
      expect(x).toBeCloseTo(lapX, 6);
      expect(y).toBeCloseTo(lapY, 6);
    });
  });

  it("holds the bodies at the start before t = 0 and at the end after it", () => {
    expect(motion.positionsAt(-1)).toEqual(motion.positionsAt(0));
    expect(motion.positionsAt(solution.period + 5)).toEqual(
      motion.positionsAt(solution.period),
    );
  });

  it("starts the trail at t = 0 instead of wrapping to the end", () => {
    const trail = motion.trailAt(TRAIL_LENGTH / 2, 0);
    expect(trail.start).toEqual(motion.positionsAt(0)[0]);
    expect(trail.curves.at(-1)?.end).toEqual(
      motion.positionsAt(TRAIL_LENGTH / 2)[0],
    );
  });

  it("has no trail at t = 0", () => {
    expect(motion.trailAt(0, 0).curves).toHaveLength(0);
  });
});
