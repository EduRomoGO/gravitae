import { describe, expect, it } from "vitest";
import { G, SURFACE_G } from "./figures";
import {
  acceleration,
  approach,
  ASTRONAUTS,
  ASTRONAUTS_AT_REST,
  astronautsContactTime,
  distanceAfterPush,
  gravitationalForce,
  speedAfterPush,
  weightAtDistance,
} from "./law";

describe("gravitationalForce", () => {
  it("is G for two kilograms one metre apart", () => {
    expect(gravitationalForce(1, 1, 1)).toBe(G);
  });

  it("falls to a quarter when the distance doubles", () => {
    expect(gravitationalForce(3, 5, 2)).toBeCloseTo(
      gravitationalForce(3, 5, 1) / 4,
      20,
    );
  });

  it("gives the astronauts about 3,3 × 10⁻⁷ N at their starting distance", () => {
    const force = gravitationalForce(
      ASTRONAUTS.massKg,
      ASTRONAUTS.massKg,
      ASTRONAUTS.startM,
    );

    expect(force).toBeCloseTo(3.27e-7, 9);
  });
});

describe("weightAtDistance", () => {
  it("is the surface gravity at one radius", () => {
    expect(weightAtDistance(SURFACE_G.Tierra, 1)).toBe(SURFACE_G.Tierra);
  });

  it("is a quarter at two radii and a ninth at three", () => {
    expect(weightAtDistance(SURFACE_G.Tierra, 2)).toBeCloseTo(2.45);
    expect(weightAtDistance(SURFACE_G.Tierra, 3)).toBeCloseTo(9.8 / 9);
  });
});

describe("approach", () => {
  it("leaves the astronauts where they are when no time passes", () => {
    expect(approach(ASTRONAUTS_AT_REST, 0)).toEqual(ASTRONAUTS_AT_REST);
  });

  it("closes the distance under the starting acceleration G·2m / r²", () => {
    const after = approach(ASTRONAUTS_AT_REST, 60);
    const a = G * 2 * ASTRONAUTS.massKg;

    expect(after.t).toBe(60);
    expect(after.v).toBeLessThan(0);
    expect(ASTRONAUTS.startM - after.r).toBeCloseTo(0.5 * a * 60 * 60, 6);
  });

  it("stops at contact and keeps them still", () => {
    const touching = approach(ASTRONAUTS_AT_REST, 24 * 3600);

    expect(touching.r).toBe(ASTRONAUTS.contactM);
    expect(touching.v).toBe(0);
    expect(approach(touching, 60)).toEqual(touching);
  });

  it("gives the same contact time in one call as in many small ones", () => {
    let stepped = ASTRONAUTS_AT_REST;
    while (stepped.r > ASTRONAUTS.contactM) stepped = approach(stepped, 0.8);

    expect(stepped.t).toBeCloseTo(astronautsContactTime(), -1);
  });
});

describe("astronautsContactTime", () => {
  it("is almost three hours, as the lesson says", () => {
    const hours = astronautsContactTime() / 3600;

    expect(hours).toBeGreaterThan(2.5);
    expect(hours).toBeLessThan(3);
  });
});

describe("push", () => {
  const push = { forceN: 200, durationS: 0.3 };

  it("accelerates a body by the force over its mass", () => {
    expect(acceleration(200, 40)).toBe(5);
  });

  it("leaves the lighter body faster", () => {
    expect(speedAfterPush(push, 40)).toBeCloseTo(1.5);
    expect(speedAfterPush(push, 80)).toBeCloseTo(0.75);
  });

  it("moves the body as ½·a·t² during the push", () => {
    expect(distanceAfterPush(push, 40, 0.2)).toBeCloseTo(0.5 * 5 * 0.04);
  });

  it("moves the body at constant speed after the push", () => {
    const atEnd = distanceAfterPush(push, 40, 0.3);

    expect(distanceAfterPush(push, 40, 1.3)).toBeCloseTo(atEnd + 1.5);
  });
});
