import { describe, expect, it } from "vitest";
import { CORRECTION_INSTRUCTIONS } from "@/lib/atomy/correction-prompt";
import { correctionAnswerSchema } from "@/lib/atomy/correction-request";

/** The outputs of the prompt's examples. */
function exampleOutputs(): unknown[] {
  return [...CORRECTION_INSTRUCTIONS.matchAll(/<salida>(.*?)<\/salida>/g)].map(
    ([, json]): unknown => JSON.parse(json ?? ""),
  );
}

describe("the correction's prompt", () => {
  it("has an example of every verdict, each a valid correction", () => {
    const outputs = exampleOutputs().map((output) =>
      correctionAnswerSchema.parse(output),
    );

    expect(outputs.map(({ verdict }) => verdict).sort()).toEqual([
      "correct",
      "incorrect",
      "incorrect",
      "incorrect",
      "incorrect",
      "partial",
    ]);
  });
});
