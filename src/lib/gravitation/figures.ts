/**
 * The physical figures the lesson shows in more than one place. Each one is
 * defined and computed here once, so a text and an experiment that quote the
 * same quantity read the same number once both round it alike.
 */

/** Universal gravitational constant, in N·m²/kg². */
export const G = 6.674e-11;

/** NASA planetary fact sheets. */
export const EARTH_MASS_KG = 5.972e24;
export const EARTH_RADIUS_KM = 6370;
export const MOON_MASS_KG = 7.346e22;
export const MOON_RADIUS_KM = 1737.4;

/** Surface gravity in m/s² (NASA planetary fact sheets). */
export const SURFACE_G = {
  Luna: 1.62,
  Marte: 3.71,
  Tierra: 9.8,
  Júpiter: 24.79,
  Saturno: 10.44,
  Urano: 8.87,
} as const;

/** A body of the lesson with a known surface gravity. */
export type Astro = keyof typeof SURFACE_G;

/** Weight in newtons of `massKg` where gravity is `g` m/s²: P = m·g. */
export function weight(massKg: number, g: number): number {
  return massKg * g;
}

/** Uranus as multiples of the Earth's mass and radius. */
export const URANUS_MASS_EARTHS = 14.5;
export const URANUS_RADIUS_EARTHS = 4.01;

/** The person of the examples. */
export const PERSON_MASS_KG = 70;
export const PERSON_WEIGHT_N = weight(PERSON_MASS_KG, SURFACE_G.Tierra);

/** Height the boxes of "Caída en cada planeta" fall from. */
export const DROP_HEIGHT_M = 30;

/** Seconds an object takes to fall `height` metres from rest: √(2h/g). */
export function fallTime(g: number, height = DROP_HEIGHT_M): number {
  return Math.sqrt((2 * height) / g);
}
