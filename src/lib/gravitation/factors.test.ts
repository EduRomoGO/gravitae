import { describe, expect, it } from "vitest";
import {
  accelerationOfA,
  accelerationOfASteps,
  accelerationOfB,
  accelerationOfBSteps,
  factorValue,
  forceFactor,
  forceSteps,
  formatFactor,
} from "./factors";

describe("forceFactor", () => {
  it("leaves the force at a quarter when the distance doubles", () => {
    const factor = forceFactor({ massA: 1, massB: 1, distance: 2 });

    expect(factorValue(factor)).toBe(0.25);
  });

  it("doubles the force when the mass of A doubles", () => {
    const factor = forceFactor({ massA: 2, massB: 1, distance: 1 });

    expect(factorValue(factor)).toBe(2);
  });

  it("keeps the force when both masses and the distance double", () => {
    const factor = forceFactor({ massA: 2, massB: 2, distance: 2 });

    expect(factorValue(factor)).toBe(1);
  });
});

describe("formatFactor", () => {
  it("writes the factor as a reduced fraction instead of a decimal", () => {
    const factor = forceFactor({ massA: 2, massB: 2, distance: 3 });

    expect(formatFactor(factor)).toBe("×4/9");
  });

  it("writes a whole factor without a denominator", () => {
    const factor = forceFactor({ massA: 2, massB: 2, distance: 2 });

    expect(formatFactor(factor)).toBe("×1");
  });

  it("reduces the fraction", () => {
    const factor = forceFactor({ massA: 2, massB: 3, distance: 2 });

    expect(formatFactor(factor)).toBe("×3/2");
  });
});

describe("forceSteps", () => {
  it("writes out the arithmetic behind the force factor", () => {
    expect(forceSteps({ massA: 2, massB: 3, distance: 2 })).toBe(
      "2 × 3 ÷ (2 × 2)",
    );
  });
});

describe("acceleration factors", () => {
  it("gives A an acceleration of ×3 and B one of ×1 when B has three times the mass", () => {
    const situation = { massA: 1, massB: 3, distance: 1 };

    expect(formatFactor(accelerationOfA(situation))).toBe("×3");
    expect(formatFactor(accelerationOfB(situation))).toBe("×1");
  });

  it("keeps the acceleration of A when the mass of A rises", () => {
    const before = accelerationOfA({ massA: 1, massB: 2, distance: 3 });
    const after = accelerationOfA({ massA: 3, massB: 2, distance: 3 });

    expect(formatFactor(before)).toBe("×2/9");
    expect(formatFactor(after)).toBe("×2/9");
  });

  it("writes out the arithmetic behind each acceleration", () => {
    const situation = { massA: 2, massB: 3, distance: 2 };

    expect(accelerationOfASteps(situation)).toBe("3 ÷ (2 × 2)");
    expect(accelerationOfBSteps(situation)).toBe("2 ÷ (2 × 2)");
  });
});
