import { describe, expect, it } from "vitest";
import { advanceTime } from "./playback";
import { TIME_UNITS_PER_SECOND } from "./playback-config";

// Expressed through the constant so tuning the playback rate keeps these valid.
const secondsToReach = (time: number, speed: number) =>
  time / (speed * TIME_UNITS_PER_SECOND);

function advanceInFrames(framesPerSecond: number, seconds: number): number {
  let time = 0;
  for (let frame = 0; frame < framesPerSecond * seconds; frame++) {
    time = advanceTime(time, 1 / framesPerSecond, 1);
  }
  return time;
}

describe("advanceTime", () => {
  it("advances the same at 60 Hz and at 120 Hz", () => {
    expect(advanceInFrames(120, 2)).toBeCloseTo(advanceInFrames(60, 2), 9);
  });

  it("advances in proportion to the elapsed time and the speed", () => {
    expect(advanceTime(1, secondsToReach(0.5, 2), 2)).toBeCloseTo(1.5, 9);
  });
});
