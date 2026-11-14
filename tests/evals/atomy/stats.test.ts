import { describe, expect, it } from "vitest";
import { judgeAgreement, rateOf } from "@tests/evals/atomy/stats";

describe("a rate with its margin", () => {
  it("gives the share of successes with its 95 % Wilson interval", () => {
    const rate = rateOf(8, 10);

    expect(rate.value).toBeCloseTo(0.8);
    expect(rate.low).toBeCloseTo(0.4902, 3);
    expect(rate.high).toBeCloseTo(0.9434, 3);
  });

  it("keeps the interval within 0 and 1 at the extremes", () => {
    const rate = rateOf(0, 5);

    expect(rate.value).toBe(0);
    expect(rate.low).toBe(0);
    expect(rate.high).toBeCloseTo(0.4345, 3);
  });
});

describe("the judge against the human labels", () => {
  it("gives the true positive and true negative rates of the labelled items", () => {
    const agreement = judgeAgreement([
      { judge: true, human: true },
      { judge: false, human: true },
      { judge: true, human: true },
      { judge: false, human: false },
      { judge: true, human: false },
      { judge: true, human: null },
    ]);

    expect(agreement.labelled).toBe(5);
    expect(agreement.truePositive?.successes).toBe(2);
    expect(agreement.truePositive?.trials).toBe(3);
    expect(agreement.trueNegative?.successes).toBe(1);
    expect(agreement.trueNegative?.trials).toBe(2);
  });

  it("gives no rate while no item has a human label", () => {
    const agreement = judgeAgreement([{ judge: true, human: null }]);

    expect(agreement.labelled).toBe(0);
    expect(agreement.truePositive).toBeNull();
    expect(agreement.trueNegative).toBeNull();
  });
});
