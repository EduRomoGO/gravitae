// The formulas of the lesson, each written once: Newton's law of gravitation,
// the weight it gives at a distance, the approach of two bodies that only
// attract each other, and the push of the second law. The experiments and the
// texts that quote their results call these instead of repeating the algebra.

import { G, PERSON_MASS_KG } from "@/lib/gravitation/figures";

/** Gravitational force in newtons between two masses `distanceM` metres apart: F = G·mA·mB / r². */
export function gravitationalForce(
  massAKg: number,
  massBKg: number,
  distanceM: number,
): number {
  return (G * massAKg * massBKg) / (distanceM * distanceM);
}

/**
 * Weight per kilogram at `radii` planet radii from the centre of a planet
 * whose surface gravity is `surfaceG`: g / r².
 */
export function weightAtDistance(surfaceG: number, radii: number): number {
  return surfaceG / (radii * radii);
}

/** Two bodies of equal mass at rest, pulled together only by their gravitation. */
export interface Approach {
  /** Seconds since they were let go. */
  readonly t: number;
  /** Distance between their centres, in metres. */
  readonly r: number;
  /** Rate at which that distance changes, in m/s (negative while they close in). */
  readonly v: number;
}

/** The two astronauts of the lesson: 70 kg each, 1 m apart, touching at 0,35 m. */
export const ASTRONAUTS = {
  massKg: PERSON_MASS_KG,
  startM: 1,
  contactM: 0.35,
} as const;

/** The astronauts the moment they are let go. */
export const ASTRONAUTS_AT_REST: Approach = {
  t: 0,
  r: ASTRONAUTS.startM,
  v: 0,
};

/** Time step of the integration, in seconds. */
const APPROACH_STEP_S = 0.5;

/**
 * Advances the astronauts `seconds` seconds. Each one pulls the other with
 * F = G·m² / r², so the distance between them shrinks with an acceleration
 * of 2·F / m = G·2m / r²; integrated with semi-implicit Euler until they touch.
 */
export function approach(state: Approach, seconds: number): Approach {
  const { massKg, contactM } = ASTRONAUTS;
  let { t, r, v } = state;
  let left = seconds;
  while (left > 0 && r > contactM) {
    const h = Math.min(APPROACH_STEP_S, left);
    v -= ((G * 2 * massKg) / (r * r)) * h;
    r += v * h;
    t += h;
    left -= h;
  }
  return { t, r: Math.max(r, contactM), v: r > contactM ? v : 0 };
}

/** Seconds the astronauts take to touch from rest. */
export function astronautsContactTime(): number {
  let state = ASTRONAUTS_AT_REST;
  while (state.r > ASTRONAUTS.contactM) state = approach(state, 3600);
  return state.t;
}

/** A push of `forceN` newtons for `durationS` seconds on a body at rest. */
export interface Push {
  readonly forceN: number;
  readonly durationS: number;
}

/** Acceleration in m/s² of a body of `massKg` under `forceN`: a = F / m (second law). */
export function acceleration(forceN: number, massKg: number): number {
  return forceN / massKg;
}

/** Speed in m/s a body of `massKg` keeps once the push is over. */
export function speedAfterPush(
  { forceN, durationS }: Push,
  massKg: number,
): number {
  return acceleration(forceN, massKg) * durationS;
}

/**
 * Metres a body of `massKg` has moved `t` seconds after the push began:
 * uniformly accelerated during the push, at constant speed after it.
 */
export function distanceAfterPush(
  push: Push,
  massKg: number,
  t: number,
): number {
  const a = acceleration(push.forceN, massKg);
  if (t <= push.durationS) return 0.5 * a * t * t;
  return (
    0.5 * a * push.durationS * push.durationS +
    speedAfterPush(push, massKg) * (t - push.durationS)
  );
}
