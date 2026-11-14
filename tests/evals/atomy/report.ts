// The eval's report, in Markdown: each figure with its 95 % margin, the
// comparison with the previous run over the same cases, the judge's
// agreement with the human labels and the requests the run spent.

import { z } from "zod";
import type { LabelItem } from "@tests/evals/atomy/labels";
import {
  compareRuns,
  metricsOf,
  thresholdMisses,
  trialResultSchema,
} from "@tests/evals/atomy/runs";
import { judgeAgreement, type Rate } from "@tests/evals/atomy/stats";

// A run as the eval writes it to evals/atomy/runs/, read back to compare.
export const runRecordSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  models: z.object({
    gemini: z.string(),
    judge: z.string(),
    reader: z.string(),
  }),
  promptVersions: z.object({
    chat: z.string(),
    correction: z.string(),
    judge: z.string(),
  }),
  repeats: z.number(),
  trials: z.array(
    trialResultSchema.extend({
      trial: z.number(),
      errors: z.array(z.string()),
    }),
  ),
  requests: z.object({ gemini: z.number(), openCode: z.number() }),
  /** Why the run stopped before its last case, if it did. */
  stopped: z.string().nullable(),
});

export type RunRecord = z.infer<typeof runRecordSchema>;

function percent(value: number): string {
  return Number.isNaN(value) ? "—" : `${(value * 100).toFixed(0)} %`;
}

function withMargin(rate: Rate): string {
  return `${percent(rate.value)} (${String(rate.successes)}/${String(rate.trials)}; 95 % CI ${percent(rate.low)}–${percent(rate.high)})`;
}

function agreementLine(criterion: string, items: readonly LabelItem[]): string {
  const agreement = judgeAgreement(
    items.filter((item) => item.criterion === criterion),
  );
  if (agreement.labelled === 0) {
    return `| ${criterion} | awaiting human labels | awaiting human labels | 0 |`;
  }
  const rate = (value: Rate | null) =>
    value ? withMargin(value) : "no labels of this class";
  return `| ${criterion} | ${rate(agreement.truePositive)} | ${rate(agreement.trueNegative)} | ${String(agreement.labelled)} |`;
}

export function reportOf({
  run,
  previous,
  labels,
  thresholds,
  criteria,
}: {
  run: RunRecord;
  previous: RunRecord | null;
  labels: readonly LabelItem[];
  thresholds: Readonly<Record<string, number>>;
  criteria: readonly string[];
}): string {
  const metrics = metricsOf(run.trials);
  const misses = thresholdMisses(metrics, thresholds);
  const lines = [
    `# Atomy eval against the real Gemini · ${run.runId}`,
    "",
    `- Model: \`${run.models.gemini}\`; prompts \`${run.promptVersions.chat}\` and \`${run.promptVersions.correction}\`.`,
    `- Judge: \`${run.models.judge}\` (\`${run.promptVersions.judge}\`); simulated reader: \`${run.models.reader}\`.`,
    `- Repeats per case: ${String(run.repeats)}; trials: ${String(run.trials.length)}.`,
    `- Requests: ${String(run.requests.gemini)} to Gemini and ${String(run.requests.openCode)} to OpenCode Go.`,
    ...(run.stopped ? [`- **Run stopped:** ${run.stopped}.`] : []),
    "",
    "## Figures",
    "",
    "| Figure | Result | Threshold |",
    "|---|---|---|",
    ...Object.entries(metrics).map(([name, rate]) => {
      const threshold = thresholds[name];
      const mark =
        threshold === undefined
          ? "—"
          : `${percent(threshold)}${misses.includes(name) ? " ✗" : " ✓"}`;
      return `| ${name} | ${withMargin(rate)} | ${mark} |`;
    }),
    "",
    "## Comparison with the previous run",
    "",
  ];
  if (!previous) {
    lines.push("No previous run to compare with.");
  } else {
    lines.push(
      `Against ${previous.runId} (prompts \`${previous.promptVersions.chat}\` and \`${previous.promptVersions.correction}\`, judge \`${previous.models.judge}\`), over the cases both share. «Beyond margin» means the two 95 % intervals do not overlap.`,
      "",
      "| Figure | Now | Before | Difference | Beyond margin |",
      "|---|---|---|---|---|",
      ...compareRuns(run.trials, previous.trials).map(
        ({ metric, current, previous: before, delta, beyondMargin }) =>
          `| ${metric} | ${withMargin(current)} | ${before ? withMargin(before) : "—"} | ${delta === null ? "—" : `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(0)} pp`} | ${beyondMargin ? "yes" : "no"} |`,
      ),
    );
  }
  lines.push(
    "",
    "## Judge validation",
    "",
    "Over every verdict in `evals/atomy/judge-labels.json` with a human label. Positive: the text meets the criterion.",
    "",
    "| Criterion | True positive rate | True negative rate | Labelled |",
    "|---|---|---|---|",
    ...criteria.map((criterion) => agreementLine(criterion, labels)),
    "",
    "## Failing trials",
    "",
  );
  const failing = run.trials.filter((trial) =>
    Object.values(trial.checks).some((passed) => !passed),
  );
  if (failing.length === 0) lines.push("None.");
  for (const trial of failing) {
    const failed = Object.entries(trial.checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    lines.push(
      `- \`${trial.caseId}\` #${String(trial.trial)}: ${failed.join(", ")}${trial.errors.length > 0 ? ` (errors: ${trial.errors.join("; ")})` : ""}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
