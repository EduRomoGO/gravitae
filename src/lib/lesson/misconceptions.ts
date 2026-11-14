// The closed catalogue of misconceptions the correction of a reasoning picks
// from, kept by the lesson: one or more per prediction in
// app/ley-gravitacion-universal-newton. Each entry names the prediction whose
// wrong answers it explains. The model chooses an id from its prediction's
// entries and cannot make new ones up.

import type { PredictionId } from "@/lib/lesson/predictions";

export interface Misconception {
  prediction: PredictionId;
  /** The idea, as the prompt describes it to the model. */
  idea: string;
}

export const MISCONCEPTIONS = {
  "caida-tiempo-proporcional": {
    prediction: "caida",
    idea: "el tiempo de caída cambia en la misma proporción que la gravedad: con seis veces menos gravedad, seis veces más tiempo",
  },
  "caida-igual-en-todas-partes": {
    prediction: "caida",
    idea: "un objeto tarda lo mismo en caer en cualquier astro",
  },
  "masa-es-peso": {
    prediction: "tiron",
    idea: "masa y peso son lo mismo",
  },
  "masa-cambia-con-el-astro": {
    prediction: "tiron",
    idea: "la masa de un objeto cambia al llevarlo a otro astro",
  },
  "mas-masa-mas-peso": {
    prediction: "planeta",
    idea: "en el planeta de más masa siempre se pesa más, sea cual sea su tamaño",
  },
  "mas-grande-mas-peso": {
    prediction: "planeta",
    idea: "en el planeta más grande se pesa más",
  },
  "distancia-sin-cuadrado": {
    prediction: "distancia",
    idea: "la fuerza disminuye con la distancia, no con su cuadrado",
  },
  "distancia-no-importa": {
    prediction: "distancia",
    idea: "alejarse del centro del astro no cambia la atracción",
  },
  "atraccion-se-gasta": {
    prediction: "esfera",
    idea: "la atracción se gasta por el camino",
  },
  "atraccion-segun-tamano-aparente": {
    prediction: "esfera",
    idea: "la atracción depende de lo grande que se ve el objeto de lejos",
  },
  "masas-se-suman": {
    prediction: "cualquiera",
    idea: "las masas se suman",
  },
  "solo-cuenta-una-masa": {
    prediction: "cualquiera",
    idea: "en la fuerza solo cuenta la masa de uno de los dos objetos",
  },
  "solo-se-atraen-planetas": {
    prediction: "cualquiera",
    idea: "solo los planetas se atraen",
  },
  "mas-masa-mas-fuerza": {
    prediction: "iguales",
    idea: "el objeto de más masa recibe más fuerza",
  },
  "mas-rapido-mas-fuerza": {
    prediction: "iguales",
    idea: "el objeto que sale más rápido recibe más fuerza",
  },
  "fuerza-segun-quien-empuja": {
    prediction: "iguales",
    idea: "quien empuja más fuerte recibe menos fuerza que el otro",
  },
  "personas-no-se-atraen": {
    prediction: "mesa",
    idea: "dos personas no se atraen: la gravedad solo actúa entre astros",
  },
  "atraccion-entre-personas-notable": {
    prediction: "mesa",
    idea: "la atracción entre dos personas basta para juntarlas en poco tiempo",
  },
} as const satisfies Record<string, Misconception>;

export type MisconceptionId = keyof typeof MISCONCEPTIONS;

function isMisconceptionId(id: string): id is MisconceptionId {
  return Object.hasOwn(MISCONCEPTIONS, id);
}

/** Every id of the catalogue, in its order. */
export const MISCONCEPTION_IDS: readonly MisconceptionId[] =
  Object.keys(MISCONCEPTIONS).filter(isMisconceptionId);

/** The ids of a prediction's misconceptions, in the catalogue's order. */
export function misconceptionsOf(prediction: PredictionId): MisconceptionId[] {
  return MISCONCEPTION_IDS.filter(
    (id) => MISCONCEPTIONS[id].prediction === prediction,
  );
}
