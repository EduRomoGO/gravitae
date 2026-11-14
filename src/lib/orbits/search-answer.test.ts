import { describe, expect, it } from "vitest";
import { integrateLap, lapOf } from "./lap";
import { answer } from "./search-answer";
import { collinearStart } from "./solutions";

const FIGURE_OF_EIGHT = {
  seed: { vx: 0.3471168881, vy: 0.5327249454 },
  period: 6.3259139829,
};

describe("answer", () => {
  it("sends the lap of a closed orbit with the closure, so the page does not integrate it again", () => {
    const response = answer({ id: 1, kind: "close", ...FIGURE_OF_EIGHT });
    if (response.kind !== "close" || response.lap === null)
      throw new Error("expected the lap of a closed orbit");

    // What crosses the postMessage is a structured clone.
    const lap = lapOf(structuredClone(response.lap));
    const expected = integrateLap({
      ...collinearStart(FIGURE_OF_EIGHT.seed),
      period: FIGURE_OF_EIGHT.period,
    });

    expect(lap.period).toBe(expected.period);
    expect(lap.stepCount).toBe(expected.stepCount);
    expect(lap.positionsAt(2.5)).toEqual(expected.positionsAt(2.5));
  });

  it("sends no lap when the orbit does not close", () => {
    const response = answer({
      id: 1,
      kind: "close",
      seed: { vx: 0.9, vy: 0.9 },
      period: 3,
    });

    expect(response).toMatchObject({ kind: "close", lap: null });
  });
});
