// The eval's figures with their margin: a share of successes
// and its 95 % Wilson interval, which stays within 0 and 1 and holds up with
// the few trials an eval against a free quota can afford.

/** z for a 95 % interval. */
const Z = 1.959964;

export interface Rate {
  successes: number;
  trials: number;
  value: number;
  low: number;
  high: number;
}

export function rateOf(successes: number, trials: number): Rate {
  if (trials === 0) {
    return { successes, trials, value: Number.NaN, low: 0, high: 1 };
  }
  const p = successes / trials;
  const z2 = Z * Z;
  const denominator = 1 + z2 / trials;
  const centre = (p + z2 / (2 * trials)) / denominator;
  const half =
    (Z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) /
    denominator;
  return {
    successes,
    trials,
    value: p,
    low: Math.max(0, centre - half),
    high: Math.min(1, centre + half),
  };
}

/**
 * A text the judge passed or failed on one criterion, and the human label
 * the user gave it, or null while it has none. A pass is a positive.
 */
export interface LabelledVerdict {
  judge: boolean;
  human: boolean | null;
}

export interface JudgeAgreement {
  labelled: number;
  /** Of the texts a human passed, the share the judge passed too. */
  truePositive: Rate | null;
  /** Of the texts a human failed, the share the judge failed too. */
  trueNegative: Rate | null;
}

export function judgeAgreement(
  verdicts: readonly LabelledVerdict[],
): JudgeAgreement {
  const positives = verdicts.filter(({ human }) => human === true);
  const negatives = verdicts.filter(({ human }) => human === false);
  return {
    labelled: positives.length + negatives.length,
    truePositive:
      positives.length > 0
        ? rateOf(
            positives.filter(({ judge }) => judge).length,
            positives.length,
          )
        : null,
    trueNegative:
      negatives.length > 0
        ? rateOf(
            negatives.filter(({ judge }) => !judge).length,
            negatives.length,
          )
        : null,
  };
}
