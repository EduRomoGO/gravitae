// How many times the gravitational force changes when each mass and the
// distance are multiplied by a whole factor. Newton's law is F = G·mA·mB / r²,
// so G cancels and the change is mA·mB / r².

/** Largest multiplier of a mass or of the distance in the explorer; the smallest is 1. */
export const MAX_MULTIPLIER = 3;

/** The two masses and the distance, each a whole multiplier of the starting situation. */
export interface Situation {
  readonly massA: number;
  readonly massB: number;
  readonly distance: number;
}

/** A factor kept as a fraction of whole numbers, so it can be shown exactly. */
export interface Fraction {
  readonly numerator: number;
  readonly denominator: number;
}

export function forceFactor({ massA, massB, distance }: Situation): Fraction {
  return { numerator: massA * massB, denominator: distance * distance };
}

export function factorValue({ numerator, denominator }: Fraction): number {
  return numerator / denominator;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Formats the factor as a reduced fraction, which a reader without physics can
 * check by hand: `×4`, `×1/4`, `×4/9`.
 */
export function formatFactor({ numerator, denominator }: Fraction): string {
  const divisor = gcd(numerator, denominator);
  const top = numerator / divisor;
  const bottom = denominator / divisor;
  return bottom === 1 ? `×${String(top)}` : `×${String(top)}/${String(bottom)}`;
}

/** The arithmetic behind the force factor, so the reader sees where it comes from. */
export function forceSteps({ massA, massB, distance }: Situation): string {
  return `${String(massA)} × ${String(massB)} ÷ (${String(distance)} × ${String(distance)})`;
}

// The acceleration of a body is the force on it divided by its own mass
// (Newton's second law), so the acceleration of A is mA·mB / r² ÷ mA = mB / r²
// and its own mass cancels.

export function accelerationOfA({ massB, distance }: Situation): Fraction {
  return { numerator: massB, denominator: distance * distance };
}

export function accelerationOfB({ massA, distance }: Situation): Fraction {
  return { numerator: massA, denominator: distance * distance };
}

/** The arithmetic behind the acceleration of A. */
export function accelerationOfASteps({ massB, distance }: Situation): string {
  return `${String(massB)} ÷ (${String(distance)} × ${String(distance)})`;
}

/** The arithmetic behind the acceleration of B. */
export function accelerationOfBSteps({ massA, distance }: Situation): string {
  return `${String(massA)} ÷ (${String(distance)} × ${String(distance)})`;
}
