// The lesson's widgets that Atomy can set with set_widget: their ids, their
// sections and the schemas of their state, with their ranges. The experiments
// register under these ids with these schemas, and the chat's route handler
// offers the model only the ones of the visible section.
// Plain data and Zod, no React: the server and the page share it.
//
// Left out, because they have no state the reader adjusts or because setting
// it would answer for the reader:
// - the drop race of «caida» only replays its fall;
// - the planet ranking of «planeta» holds the reader's own answer to its
//   question.

import { z } from "zod";
import type { SectionId } from "@/lib/lesson/sections";
import type { Situation } from "@/lib/gravitation/factors";
import type { Astro } from "@/lib/gravitation/figures";

/**
 * A whole number from `min` to `max`, both included. Its error, prefixed with
 * the field's name, names the range.
 */
export function wholeNumber(min: number, max: number): z.ZodInt {
  const error = `must be a whole number from ${String(min)} to ${String(max)}`;
  return z.int({ error }).min(min, { error }).max(max, { error });
}

/** The astros the spring scale travels to, as the experiment names them. */
export const SPRING_SCALE_PLANETS = [
  "Luna",
  "Tierra",
  "Júpiter",
] as const satisfies readonly Astro[];
/** The mass of the object on the spring scale, the same on every astro. */
export const SPRING_SCALE_MASS_KG = 1;
export const TOWER_MAX_DISTANCE = 3;
export const SPHERE_MAX_DISTANCE = 4;
export const THREADS_MAX_MASS = 4;
export const THREADS_MAX_DISTANCE = 3;
export const SKATER_MIN_KG = 20;
export const SKATER_MAX_KG = 200;
export const SKATER_STEP_KG = 20;
/** How fast time runs for the two astronauts. */
export const ASTRONAUT_SPEEDS = ["×1", "×60", "×600", "×3.600"] as const;

const skaterKg = wholeNumber(SKATER_MIN_KG, SKATER_MAX_KG).multipleOf(
  SKATER_STEP_KG,
  {
    error: `must be a multiple of ${String(SKATER_STEP_KG)} from ${String(SKATER_MIN_KG)} to ${String(SKATER_MAX_KG)}`,
  },
);

/** Each widget's state, with its ranges and the words the model reads. */
const STATES = {
  dinamometro: z.strictObject({
    planet: z
      .enum(SPRING_SCALE_PLANETS)
      .describe(
        `El astro sobre el que cuelga el objeto de ${String(SPRING_SCALE_MASS_KG)} kg`,
      ),
  }),
  ascensor: z.strictObject({
    distance: wholeNumber(1, TOWER_MAX_DISTANCE).describe(
      "A cuántas veces el radio de la Tierra está el ascensor de su centro",
    ),
  }),
  esfera: z.strictObject({
    distance: wholeNumber(1, SPHERE_MAX_DISTANCE).describe(
      "A cuántas veces el radio del planeta está B de su centro",
    ),
  }),
  // The same situation the force factor is worked out from.
  hilos: z.strictObject({
    massA: wholeNumber(1, THREADS_MAX_MASS).describe("Bolitas de A"),
    massB: wholeNumber(1, THREADS_MAX_MASS).describe("Bolitas de B"),
    distance: wholeNumber(1, THREADS_MAX_DISTANCE).describe(
      "Cuántas veces se multiplica la distancia",
    ),
  }) satisfies z.ZodType<Situation>,
  patinadores: z.strictObject({
    massA: skaterKg.describe("La masa del patinador de la izquierda, en kg"),
    massB: skaterKg.describe("La masa del patinador de la derecha, en kg"),
  }),
  astronautas: z.strictObject({
    speed: z
      .enum(ASTRONAUT_SPEEDS)
      .describe("A qué velocidad pasa el tiempo para los astronautas"),
  }),
};

export type WidgetId = keyof typeof STATES;

export type WidgetStateOf<Id extends WidgetId> = z.infer<(typeof STATES)[Id]>;

/**
 * The schema each widget registers in the lesson controller with. Module
 * level, so it keeps its identity across renders.
 */
export const WIDGET_STATES: {
  readonly [Id in WidgetId]: z.ZodType<WidgetStateOf<Id>>;
} = STATES;

export function isWidgetId(id: string): id is WidgetId {
  return Object.hasOwn(STATES, id);
}

export const WIDGET_IDS: readonly WidgetId[] =
  Object.keys(STATES).filter(isWidgetId);

/** The section each widget is in. */
export const WIDGET_SECTIONS: Readonly<Record<WidgetId, SectionId>> = {
  dinamometro: "tiron",
  ascensor: "distancia",
  esfera: "distancia",
  hilos: "cualquiera",
  patinadores: "iguales",
  astronautas: "mesa",
};

const widget = <Id extends WidgetId>(id: Id) =>
  z.literal(id).describe("El widget de la lección");

const CALLS = {
  dinamometro: STATES.dinamometro.extend({ widget: widget("dinamometro") }),
  ascensor: STATES.ascensor.extend({ widget: widget("ascensor") }),
  esfera: STATES.esfera.extend({ widget: widget("esfera") }),
  hilos: STATES.hilos.extend({ widget: widget("hilos") }),
  patinadores: STATES.patinadores.extend({ widget: widget("patinadores") }),
  astronautas: STATES.astronautas.extend({ widget: widget("astronautas") }),
};

/** A widget and the state to set it to: set_widget's input and output. */
export const widgetChange = z.discriminatedUnion("widget", [
  CALLS.dinamometro,
  CALLS.ascensor,
  CALLS.esfera,
  CALLS.hilos,
  CALLS.patinadores,
  CALLS.astronautas,
]);

export type WidgetChange = z.infer<typeof widgetChange>;

/**
 * set_widget's input restricted to `ids`, the widgets of the visible section:
 * a single widget's own object, or the union of several. Null without any.
 */
export function widgetChangeOf(
  ids: readonly WidgetId[],
): z.ZodType<WidgetChange> | null {
  const [first, ...rest] = ids.map((id) => CALLS[id]);
  if (first === undefined) return null;
  if (rest.length === 0) return first;
  return z.discriminatedUnion("widget", [first, ...rest]);
}

/** How the chat's action line names each widget. */
export const WIDGET_NAMES: Readonly<Record<WidgetId, string>> = {
  dinamometro: "el dinamómetro",
  ascensor: "el ascensor",
  esfera: "la esfera",
  hilos: "las bolitas e hilos",
  patinadores: "los patinadores",
  astronautas: "los dos astronautas",
};

/** The widget's state in words, for the chat's action line. */
export function describeWidget(change: WidgetChange): string {
  switch (change.widget) {
    case "dinamometro":
      return `en ${change.planet}`;
    case "ascensor":
      return `a distancia ×${String(change.distance)} del centro de la Tierra`;
    case "esfera":
      return `con B a distancia ×${String(change.distance)} del centro`;
    case "hilos":
      return `en masa A ×${String(change.massA)}, masa B ×${String(change.massB)} y distancia ×${String(change.distance)}`;
    case "patinadores":
      return `en ${String(change.massA)} kg el de la izquierda y ${String(change.massB)} kg el de la derecha`;
    case "astronautas":
      return `con el tiempo a ${change.speed}`;
  }
}

/** Each widget's state as set_widget's change, tagged with its id. */
const CHANGES: {
  readonly [Id in WidgetId]: (state: WidgetStateOf<Id>) => WidgetChange;
} = {
  dinamometro: (state) => ({ ...state, widget: "dinamometro" }),
  ascensor: (state) => ({ ...state, widget: "ascensor" }),
  esfera: (state) => ({ ...state, widget: "esfera" }),
  hilos: (state) => ({ ...state, widget: "hilos" }),
  patinadores: (state) => ({ ...state, widget: "patinadores" }),
  astronautas: (state) => ({ ...state, widget: "astronautas" }),
};

/** A widget's state as set_widget's change, its type kept by `id`. */
export function widgetChangeFrom<Id extends WidgetId>(
  id: Id,
  state: WidgetStateOf<Id>,
): WidgetChange {
  const change: (state: WidgetStateOf<Id>) => WidgetChange = CHANGES[id];
  return change(state);
}
