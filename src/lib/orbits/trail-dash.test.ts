import { describe, expect, it } from "vitest";
import { lapThrough, type LapStep } from "./lap";
import { TRAIL_LENGTH } from "./playback-config";
import { lapTrails } from "./trail-dash";

const STEPS = 400;
const PERIOD = 2 * Math.PI;
const RADII = [1, 2, 3] as const;

/** Three bodies going round circles of radius 1, 2 and 3 at 1 radian per unit of time. */
const CIRCLES = lapThrough(
  PERIOD,
  Array.from({ length: STEPS }, (_, step): LapStep => {
    const time = (step / STEPS) * PERIOD;
    const [r0, r1, r2] = RADII;
    const at = (r: number): [number, number] => [
      r * Math.cos(time),
      r * Math.sin(time),
    ];
    const moving = (r: number): [number, number] => [
      -r * Math.sin(time),
      r * Math.cos(time),
    ];
    return {
      time,
      positions: [at(r0), at(r1), at(r2)],
      velocities: [moving(r0), moving(r1), moving(r2)],
    };
  }),
);

describe("lapTrails", () => {
  it("measures each body's closed path", () => {
    const { pathLengths } = lapTrails(CIRCLES);

    RADII.forEach((r, body) => {
      expect(pathLengths[body]).toBeCloseTo(2 * Math.PI * r, 3);
    });
  });

  it("lays the trail along the path, one trail length behind the body", () => {
    const trails = lapTrails(CIRCLES);

    const { offset, length } = trails.dashAt(2, 1);

    expect(offset).toBeCloseTo((2 - TRAIL_LENGTH) * 2, 3);
    expect(length).toBeCloseTo(TRAIL_LENGTH * 2, 3);
  });

  it("starts a trail that began in the previous lap near the end of the path", () => {
    const trails = lapTrails(CIRCLES);

    const { offset, length } = trails.dashAt(0.3, 0);

    expect(offset).toBeCloseTo(2 * Math.PI - (TRAIL_LENGTH - 0.3), 3);
    expect(length).toBeCloseTo(TRAIL_LENGTH, 3);
  });

  it("repeats every period", () => {
    const trails = lapTrails(CIRCLES);

    const first = trails.dashAt(1.7, 2);
    const later = trails.dashAt(1.7 + 3 * PERIOD, 2);

    expect(later.offset).toBeCloseTo(first.offset, 6);
    expect(later.length).toBeCloseTo(first.length, 6);
  });
});
