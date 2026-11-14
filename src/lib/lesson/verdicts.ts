// How Atomy judges the reader's reasoning in a prediction: the verdict of a
// correction. A correct verdict resolves the prediction without its
// experiment.

export const VERDICTS = ["correct", "partial", "incorrect"] as const;

export type Verdict = (typeof VERDICTS)[number];
