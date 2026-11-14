import { describe, expect, it } from "vitest";
import {
  correctionRequestSchema,
  type CorrectionRequest,
} from "@/lib/atomy/correction-request";
import { PREDICTION_SECTION_IDS } from "@/lib/lesson/predictions";

const SECTION_TEXT = { title: "Un título", text: "Un texto." };

const REQUEST: CorrectionRequest = {
  section: { id: "distancia", ...SECTION_TEXT },
  prediction: {
    id: "esfera",
    question: "¿Por qué cae a la cuarta parte?",
    chosen: "Porque se gasta por el camino",
    answer: "Porque se reparte hacia arriba y hacia los lados a la vez",
    revealed: false,
  },
  reasoning: "Porque se va perdiendo.",
};

describe("the section of a correction request", () => {
  it("is one of the sections with a prediction", () => {
    expect(PREDICTION_SECTION_IDS).toEqual([
      "caida",
      "tiron",
      "planeta",
      "distancia",
      "cualquiera",
      "iguales",
      "mesa",
    ]);
  });

  it("does not compile for a section without a prediction", () => {
    const valid: CorrectionRequest["section"] = { id: "mesa", ...SECTION_TEXT };
    const formula: CorrectionRequest["section"] = {
      // @ts-expect-error `formula` has no prediction
      id: "formula",
      ...SECTION_TEXT,
    };
    const tres: CorrectionRequest["section"] = {
      // @ts-expect-error `tres` has no prediction
      id: "tres",
      ...SECTION_TEXT,
    };
    expect([valid, formula, tres].map((section) => section.id)).toEqual([
      "mesa",
      "formula",
      "tres",
    ]);
  });

  it("is the section of the prediction it corrects", () => {
    expect(correctionRequestSchema.safeParse(REQUEST).success).toBe(true);
    expect(
      correctionRequestSchema.safeParse({
        ...REQUEST,
        section: { ...REQUEST.section, id: "caida" },
      }).success,
    ).toBe(false);
  });
});
