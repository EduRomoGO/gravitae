import { describe, expect, it } from "vitest";
import {
  compareRuns,
  metricsOf,
  thresholdMisses,
  type TrialResult,
} from "@tests/evals/atomy/runs";

function trial(
  caseId: string,
  checks: Record<string, boolean>,
  category: TrialResult["category"] = "correct",
): TrialResult {
  return { caseId, category, checks };
}

describe("the eval's figures", () => {
  it("counts each check over the trials that have it, and each category's trials that pass every check", () => {
    const metrics = metricsOf([
      trial("a", { verdict: true, plain_text: true }),
      trial("a", { verdict: false, plain_text: true }),
      trial("b", { plain_text: false }, "adversarial"),
    ]);

    expect(metrics.verdict).toMatchObject({ successes: 1, trials: 2 });
    expect(metrics.plain_text).toMatchObject({ successes: 2, trials: 3 });
    expect(metrics.category_correct).toMatchObject({
      successes: 1,
      trials: 2,
    });
    expect(metrics.category_adversarial).toMatchObject({
      successes: 0,
      trials: 1,
    });
  });

  it("names the figures below their threshold", () => {
    const metrics = metricsOf([
      trial("a", { verdict: true, plain_text: false }),
      trial("a", { verdict: true, plain_text: true }),
    ]);

    expect(thresholdMisses(metrics, { verdict: 0.9, plain_text: 0.9 })).toEqual(
      ["plain_text"],
    );
  });
});

describe("the comparison with the previous run", () => {
  it("compares only the cases both runs share", () => {
    const rows = compareRuns(
      [trial("a", { verdict: true }), trial("b", { verdict: false })],
      [trial("a", { verdict: false }), trial("c", { verdict: true })],
    );

    const row = rows.find(({ metric }) => metric === "verdict");
    expect(row?.current).toMatchObject({ successes: 1, trials: 1 });
    expect(row?.previous).toMatchObject({ successes: 0, trials: 1 });
    expect(row?.delta).toBe(1);
  });

  it("marks a change as beyond the margin only when the two intervals do not overlap", () => {
    const many = (n: number, pass: boolean) =>
      Array.from({ length: n }, () => trial("a", { verdict: pass }));

    const [beyond] = compareRuns(many(20, true), many(20, false));
    const [within] = compareRuns(
      [...many(3, true), ...many(1, false)],
      [...many(2, true), ...many(2, false)],
    );

    expect(beyond?.beyondMargin).toBe(true);
    expect(within?.beyondMargin).toBe(false);
  });

  it("has no previous figure for a check the previous run did not make", () => {
    const [row] = compareRuns([trial("a", { nuevo: true })], [trial("a", {})]);

    expect(row?.previous).toBeNull();
    expect(row?.beyondMargin).toBe(false);
  });
});
