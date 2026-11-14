import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSolution } from "./solutions";

let getLap: typeof import("./cache").getLap;

// Every test starts with an empty cache, so each one runs the integrator
// instead of reading the lap a previous test left cached.
beforeEach(async () => {
  vi.resetModules();
  ({ getLap } = await import("./cache"));
});

describe("getLap", () => {
  it("calculates the lap of the requested solution", () => {
    const solution = getSolution("lagrange");
    const lap = getLap("lagrange");

    expect(lap.period).toBe(solution.period);
    expect(lap.step(0).positions).toEqual(solution.positions);
  });

  it("returns the already calculated lap on the second request", () => {
    expect(getLap("goggles")).toBe(getLap("goggles"));
  });

  it("calculates each solution separately", () => {
    expect(getLap("goggles")).not.toBe(getLap("moth-i"));
  });
});
