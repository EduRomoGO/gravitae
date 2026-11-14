import { describe, expect, it } from "vitest";
import {
  CLOSED_ERROR,
  closeOrbit,
  knownMatchOf,
  seedOf,
  simulateSeed,
} from "./search";
import { getSolution, SOLUTION_SLUGS } from "./solutions";

const COLLINEAR_SLUGS = SOLUTION_SLUGS.filter((slug) => slug !== "lagrange");

describe("seedOf", () => {
  it("gives the outer bodies' velocity of a collinear orbit", () => {
    expect(seedOf("figura-de-ocho")).toEqual({
      vx: 0.3471168881,
      vy: 0.5327249454,
    });
  });

  it("gives none for Lagrange, which starts in a triangle", () => {
    expect(seedOf("lagrange")).toBeNull();
  });
});

describe("simulateSeed", () => {
  it.each(COLLINEAR_SLUGS)("finds the return of %s at its period", (slug) => {
    const seed = seedOf(slug);
    if (!seed) throw new Error("collinear");
    const { period } = getSolution(slug);
    const simulation = simulateSeed(seed, period * 1.2);
    if (simulation.kind !== "open") throw new Error(simulation.kind);
    expect(simulation.bestReturn?.time).toBeCloseTo(period, 1);
    expect(simulation.bestReturn?.distance).toBeLessThan(0.05);
    expect(simulation.trajectory.paths).toHaveLength(3);
    expect(simulation.trajectory.endTime).toBe(period * 1.2);
  });

  it("reports a collision with the trajectory up to it", () => {
    // At rest, the bodies fall straight into one another.
    const simulation = simulateSeed({ vx: 0, vy: 0 }, 10);
    if (simulation.kind !== "collision") throw new Error(simulation.kind);
    expect(simulation.trajectory.collided).toBe(true);
    expect(simulation.trajectory.endTime).toBeGreaterThan(0);
    expect(simulation.trajectory.endTime).toBeLessThan(10);
    expect(simulation.trajectory.paths).toHaveLength(3);
  });
});

describe("closeOrbit", () => {
  it("closes a seed near the figure of eight onto it", () => {
    const closure = closeOrbit({ vx: 0.3481, vy: 0.5317 }, 6.3);
    if (closure.kind !== "closed") throw new Error(closure.kind);
    expect(closure.error).toBeLessThan(CLOSED_ERROR);
    expect(closure.period).toBeCloseTo(6.3259139829, 5);
    expect(closure.seed.vx).toBeCloseTo(0.3471168881, 5);
    expect(closure.seed.vy).toBeCloseTo(0.5327249454, 5);
    expect(closure.knownMatch).toEqual({ slug: "figura-de-ocho", laps: 1 });
  });

  it("closes a catalogue seed in no iterations", () => {
    const closure = closeOrbit(
      { vx: 0.3471168881, vy: 0.5327249454 },
      6.3259139829,
    );
    expect(closure).toMatchObject({ kind: "closed", iterations: 0 });
  });

  it("gives up on a seed far from any closed orbit", () => {
    const closure = closeOrbit({ vx: 0.9, vy: 0.9 }, 3);
    expect(closure.kind).not.toBe("closed");
  });
});

describe("knownMatchOf", () => {
  it("recognises the catalogue orbit mirrored or run backwards", () => {
    expect(
      knownMatchOf({ vx: -0.3471168881, vy: 0.5327249454 }, 6.3259139829),
    ).toEqual({ slug: "figura-de-ocho", laps: 1 });
  });

  it("counts the laps of a period that spans several", () => {
    expect(
      knownMatchOf({ vx: 0.3471168881, vy: 0.5327249454 }, 2 * 6.3259139829),
    ).toEqual({ slug: "figura-de-ocho", laps: 2 });
  });

  it("gives none for a seed outside the catalogue", () => {
    expect(knownMatchOf({ vx: 0.1, vy: 0.1 }, 5)).toBeNull();
  });
});

describe("the best return", () => {
  it("is the first lap of a catalogue orbit, not a later one as close", () => {
    const seed = seedOf("moth-i");
    if (!seed) throw new Error("collinear");
    const simulation = simulateSeed(seed, 30);
    if (simulation.kind !== "open") throw new Error(simulation.kind);
    expect(simulation.bestReturn?.time).toBeCloseTo(
      getSolution("moth-i").period,
      1,
    );
  });
});
