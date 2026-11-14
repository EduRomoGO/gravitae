import { describe, expect, it } from "vitest";
import { mergeLabels, type LabelItem } from "@tests/evals/atomy/labels";

function item(id: string, human: boolean | null, judge = true): LabelItem {
  return {
    id,
    caseId: "case",
    criterion: "faithfulness",
    section: "distancia",
    question: "¿Por qué?",
    text: "Porque sí.",
    judge,
    judgeReason: "",
    human,
  };
}

describe("the file of the judge's verdicts to label", () => {
  it("keeps the labels the user wrote and adds the new verdicts unlabelled", () => {
    const merged = mergeLabels(
      [item("run1/a", true), item("run1/b", null)],
      [item("run1/a", null, false), item("run2/a", null)],
    );

    expect(
      merged.map(({ id, human, judge }) => ({ id, human, judge })),
    ).toEqual([
      { id: "run1/a", human: true, judge: true },
      { id: "run1/b", human: null, judge: true },
      { id: "run2/a", human: null, judge: true },
    ]);
  });
});
