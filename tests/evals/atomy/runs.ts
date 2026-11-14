// The figures of an eval run and their comparison with the previous run over
// the same cases. A trial is one repetition of one case, with
// the result of each of its checks, programmatic or of the judge.

import { z } from "zod";
import { rateOf, type Rate } from "@tests/evals/atomy/stats";

export const CATEGORIES = ["correct", "borderline", "adversarial"] as const;

export type Category = (typeof CATEGORIES)[number];

export const trialResultSchema = z.object({
  caseId: z.string(),
  category: z.enum(CATEGORIES),
  /** Each check of the trial and whether it passed. */
  checks: z.record(z.string(), z.boolean()).readonly(),
});

export type TrialResult = z.infer<typeof trialResultSchema>;

export type Metrics = Record<string, Rate>;

/**
 * Each check over the trials that make it, then each category over its
 * trials, a trial passing when every one of its checks passes.
 */
export function metricsOf(trials: readonly TrialResult[]): Metrics {
  const counts = new Map<string, { successes: number; trials: number }>();
  const count = (name: string, passed: boolean) => {
    const current = counts.get(name) ?? { successes: 0, trials: 0 };
    counts.set(name, {
      successes: current.successes + (passed ? 1 : 0),
      trials: current.trials + 1,
    });
  };
  for (const { checks } of trials) {
    for (const [name, passed] of Object.entries(checks)) count(name, passed);
  }
  for (const category of CATEGORIES) {
    for (const trial of trials) {
      if (trial.category === category) {
        count(
          `category_${category}`,
          Object.values(trial.checks).every(Boolean),
        );
      }
    }
  }
  return Object.fromEntries(
    [...counts].map(([name, { successes, trials: n }]) => [
      name,
      rateOf(successes, n),
    ]),
  );
}

/** The figures whose share falls below their threshold. */
export function thresholdMisses(
  metrics: Metrics,
  thresholds: Readonly<Record<string, number>>,
): string[] {
  return Object.entries(thresholds)
    .filter(([name, threshold]) => {
      const rate = metrics[name];
      return rate !== undefined && rate.value < threshold;
    })
    .map(([name]) => name);
}

export interface ComparisonRow {
  metric: string;
  current: Rate;
  previous: Rate | null;
  /** Current share minus the previous one; null without a previous one. */
  delta: number | null;
  /**
   * Whether the two 95 % intervals do not overlap: a conservative sign that
   * the change is more than the noise of the repetitions.
   */
  beyondMargin: boolean;
}

/** The current run against the previous one, over the cases both share. */
export function compareRuns(
  current: readonly TrialResult[],
  previous: readonly TrialResult[],
): ComparisonRow[] {
  const shared = new Set(previous.map(({ caseId }) => caseId));
  const now = metricsOf(current.filter(({ caseId }) => shared.has(caseId)));
  const before = metricsOf(
    previous.filter(({ caseId }) =>
      current.some((trial) => trial.caseId === caseId),
    ),
  );
  return Object.entries(now).map(([metric, rate]) => {
    const old = before[metric] ?? null;
    return {
      metric,
      current: rate,
      previous: old,
      delta: old ? rate.value - old.value : null,
      beyondMargin: old ? rate.low > old.high || old.low > rate.high : false,
    };
  });
}
