// The three planets of "Ordena los planetas", shared by the experiment and by
// the lesson, which states the right order as the prediction's answer and
// explains it. A plain module, so the lesson's server page reads its values.

import { formatDecimal } from "@/lib/format";
import {
  SURFACE_G,
  URANUS_MASS_EARTHS,
  URANUS_RADIUS_EARTHS,
} from "@/lib/gravitation/figures";

/** NASA planetary fact sheets: mass and radius as multiples of the Earth's. */
export const PLANETS = [
  {
    name: "Saturno",
    mass: 95.2,
    radius: 9.45,
    g: SURFACE_G.Saturno,
    color: "fill-amber-300",
  },
  {
    name: "Tierra",
    mass: 1,
    radius: 1,
    g: SURFACE_G.Tierra,
    color: "fill-emerald-600",
  },
  {
    name: "Urano",
    mass: URANUS_MASS_EARTHS,
    radius: URANUS_RADIUS_EARTHS,
    g: SURFACE_G.Urano,
    color: "fill-cyan-400",
  },
] as const;

export type Planet = (typeof PLANETS)[number];
export type PlanetName = Planet["name"];

export const PLANET_NAMES = PLANETS.map((planet) => planet.name);

/** The planets from where 1 kg weighs most to where it weighs least. */
export const BY_WEIGHT: readonly Planet[] = [...PLANETS].sort(
  (a, b) => b.g - a.g,
);

/** The right order, the answer to the prediction. */
export const RIGHT_NAMES: readonly PlanetName[] = BY_WEIGHT.map(
  (planet) => planet.name,
);

export const SATURN = PLANETS[0];
export const URANUS = PLANETS[2];

/** A planet's mass in Earth masses, with one decimal below 20. */
export const massTimes = (mass: number): string =>
  formatDecimal(mass, mass < 20 ? 1 : 0);
