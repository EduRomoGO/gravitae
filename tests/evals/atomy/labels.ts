// The judge's verdicts the user labels by hand, to validate the judge against
// human labels. Each run adds its verdicts with `human` null;
// the user sets it to true (the text meets the criterion) or false, and the
// report gives the judge's true positive and true negative rates over the
// labelled ones. The file is JSON, in evals/atomy/judge-labels.json.

import { z } from "zod";

export const labelItemSchema = z.object({
  /** The run, the case, the trial and the criterion. */
  id: z.string(),
  caseId: z.string(),
  criterion: z.string(),
  section: z.string(),
  /** The reader's question or reasoning the text answers. */
  question: z.string(),
  /** The model's text the judge read. */
  text: z.string(),
  judge: z.boolean(),
  judgeReason: z.string(),
  /** The user's label: whether the text meets the criterion. */
  human: z.boolean().nullable(),
});

export type LabelItem = z.infer<typeof labelItemSchema>;

/** The file's items, then the new ones it did not have; labels stay. */
export function mergeLabels(
  existing: readonly LabelItem[],
  added: readonly LabelItem[],
): LabelItem[] {
  const ids = new Set(existing.map(({ id }) => id));
  return [...existing, ...added.filter(({ id }) => !ids.has(id))];
}
