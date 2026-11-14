// The calculation tools of the chat: Atomy quotes numbers the app computes
// with the gravitation module, never numbers the model works out.
// They run on the server and only calculate. The AI SDK validates
// every call against its inputSchema; an invalid call goes back to the model
// as a tool error, not as an exception of the route handler.

import { tool } from "ai";
import { z } from "zod";
import {
  forceFactor,
  forceSteps,
  formatFactor,
  type Situation,
} from "@/lib/gravitation/factors";
import {
  SURFACE_G,
  fallTime,
  weight,
  type Astro,
} from "@/lib/gravitation/figures";
import { formatUpTo } from "@/lib/format";
import {
  THREADS_MAX_DISTANCE,
  THREADS_MAX_MASS,
  wholeNumber,
} from "@/lib/lesson/widgets";

/** The heaviest mass a question of the lesson needs, in kg. */
export const MAX_MASS_KG = 10_000;
/** The highest drop a question of the lesson needs, in m. */
export const MAX_HEIGHT_M = 10_000;

// Keyed by every Astro: fails to compile if SURFACE_G gains a body this does
// not list.
const ASTROS = {
  Luna: "Luna",
  Marte: "Marte",
  Tierra: "Tierra",
  Júpiter: "Júpiter",
  Saturno: "Saturno",
  Urano: "Urano",
} as const satisfies { [Name in Astro]: Name };

const astro = z.enum(ASTROS).describe("El astro en cuya superficie se está");

/** Every text a tool answers with is a short figure or calculation. */
const figure = z.string().max(100);

function gravityText(g: number): string {
  return `${formatUpTo(g)} m/s²`;
}

/**
 * compute_force_factor's input: a Situation, each multiplier within the
 * largest range the lesson offers, the threads widget's, so the tool
 * calculates any situation the reader can set. The explorer stays within
 * MAX_MULTIPLIER, which this range covers.
 */
export const computeForceFactorInput = z.strictObject({
  massA: wholeNumber(1, THREADS_MAX_MASS).describe(
    "Cuántas veces se multiplica la masa A",
  ),
  massB: wholeNumber(1, THREADS_MAX_MASS).describe(
    "Cuántas veces se multiplica la masa B",
  ),
  distance: wholeNumber(1, THREADS_MAX_DISTANCE).describe(
    "Cuántas veces se multiplica la distancia",
  ),
}) satisfies z.ZodType<Situation>;

export const computeForceFactorOutput = z.strictObject({
  factor: figure,
  steps: figure,
});

export const weightOnInput = z.strictObject({
  body: astro,
  massKg: z
    .number()
    .positive()
    .max(MAX_MASS_KG)
    .describe("La masa del objeto o de la persona, en kg"),
});

export const weightOnOutput = z.strictObject({
  weight: figure,
  gravity: figure,
});

export const fallTimeInput = z.strictObject({
  body: astro,
  heightM: z
    .number()
    .positive()
    .max(MAX_HEIGHT_M)
    .describe("La altura desde la que se suelta el objeto, en m"),
});

export const fallTimeOutput = z.strictObject({
  time: figure,
  gravity: figure,
});

export const CALC_TOOL_NAMES = [
  "compute_force_factor",
  "weight_on",
  "fall_time",
] as const;

export type CalcToolName = (typeof CALC_TOOL_NAMES)[number];

export const CALC_TOOLS = {
  compute_force_factor: tool({
    description:
      "Calcula cuántas veces cambia la fuerza de gravedad al multiplicar cada masa y la distancia por un número entero. Devuelve el factor como fracción exacta y la cuenta que lo da.",
    inputSchema: computeForceFactorInput,
    outputSchema: computeForceFactorOutput,
    execute: (situation) => {
      const factor = forceFactor(situation);
      return { factor: formatFactor(factor), steps: forceSteps(situation) };
    },
  }),
  weight_on: tool({
    description:
      "Calcula el peso, en newtons, de una masa en la superficie de un astro de la lección.",
    inputSchema: weightOnInput,
    outputSchema: weightOnOutput,
    execute: ({ body, massKg }) => {
      const g = SURFACE_G[body];
      return {
        weight: `${formatUpTo(weight(massKg, g), 1)} N`,
        gravity: gravityText(g),
      };
    },
  }),
  fall_time: tool({
    description:
      "Calcula cuánto tarda en caer, sin aire, un objeto soltado desde una altura en la superficie de un astro de la lección.",
    inputSchema: fallTimeInput,
    outputSchema: fallTimeOutput,
    execute: ({ body, heightM }) => {
      const g = SURFACE_G[body];
      return {
        time: `${formatUpTo(fallTime(g, heightM))} s`,
        gravity: gravityText(g),
      };
    },
  }),
} satisfies Record<CalcToolName, unknown>;
