// The ids of the lesson's predictions and the section each one is in, as
// app/ley-gravitacion-universal-newton renders them; predictions.test.tsx
// renders the lesson and checks they match. A prediction's progress (its
// answer, the reasoning and Atomy's correction), its misconceptions and the
// chat opened from it are kept under its id, so that rewording its question
// or its options keeps them. A section may hold more than one prediction:
// «distancia» holds «distancia» and «esfera».

import type { SectionId } from "@/lib/lesson/sections";

export const PREDICTION_IDS = [
  "caida",
  "tiron",
  "planeta",
  "distancia",
  "esfera",
  "cualquiera",
  "iguales",
  "mesa",
] as const;

export type PredictionId = (typeof PREDICTION_IDS)[number];

/** The section each prediction is in. */
export const PREDICTION_SECTIONS = {
  caida: "caida",
  tiron: "tiron",
  planeta: "planeta",
  distancia: "distancia",
  esfera: "distancia",
  cualquiera: "cualquiera",
  iguales: "iguales",
  mesa: "mesa",
} as const satisfies Record<PredictionId, SectionId>;

/** A section with a prediction. */
export type PredictionSectionId = (typeof PREDICTION_SECTIONS)[PredictionId];

/** The sections with a prediction, in the lesson's order, each once. */
export const PREDICTION_SECTION_IDS: readonly PredictionSectionId[] = [
  ...new Set(PREDICTION_IDS.map((id) => PREDICTION_SECTIONS[id])),
];
