import { describe, expect, it, vi } from "vitest";
import {
  formatCoordinate,
  formatDecimal,
  formatLapTime,
  formatPlaybackSpeed,
  formatSimulationTime,
  formatSmall,
  formatThousands,
  formatUpTo,
} from "@/lib/format";

describe("formatSimulationTime", () => {
  it("writes two decimals with a decimal comma", () => {
    expect(formatSimulationTime(6.3259)).toBe("6,33");
  });

  it("keeps the trailing zeros", () => {
    expect(formatSimulationTime(2)).toBe("2,00");
  });
});

describe("formatLapTime", () => {
  it("writes tenths with a decimal comma", () => {
    expect(formatLapTime(2.4)).toBe("2,4");
    expect(formatLapTime(2.449)).toBe("2,4");
  });

  it("keeps the trailing zero", () => {
    expect(formatLapTime(0)).toBe("0,0");
  });
});

describe("formatCoordinate", () => {
  it("writes a decimal comma and the minus sign", () => {
    expect(formatCoordinate(-0.6942337762)).toBe("−0,6942337762");
  });

  it("removes the binary noise of a product and the trailing zeros", () => {
    expect(formatCoordinate(-2 * 0.3068934205)).toBe("−0,613786841");
    expect(formatCoordinate(0.5)).toBe("0,5");
  });

  it("writes whole numbers without decimals", () => {
    expect(formatCoordinate(-1)).toBe("−1");
  });

  it("writes negative zero, and values that round to it, as 0", () => {
    expect(formatCoordinate(-0)).toBe("0");
    expect(formatCoordinate(-0.00000000001)).toBe("0");
  });
});

describe("formatPlaybackSpeed", () => {
  it("writes the multiplier with a decimal comma and no trailing zeros", () => {
    expect(formatPlaybackSpeed(0.5)).toBe("0,5×");
    expect(formatPlaybackSpeed(2)).toBe("2×");
  });
});

describe("formatSmall", () => {
  it("writes a value below 0,01 in scientific notation with a superscript exponent", () => {
    expect(formatSmall(3.14e-8)).toBe("3,1 · 10⁻⁸");
    expect(formatSmall(-2.5e-12)).toBe("−2,5 · 10⁻¹²");
  });

  it("writes a larger value with up to four decimals, and zero as 0", () => {
    expect(formatSmall(0.123456)).toBe("0,1235");
    expect(formatSmall(0)).toBe("0");
  });
});

describe("formatDecimal", () => {
  it("writes one decimal by default, keeping the trailing zero", () => {
    expect(formatDecimal(9.8)).toBe("9,8");
    expect(formatDecimal(3)).toBe("3,0");
  });

  it("writes the decimals asked for", () => {
    expect(formatDecimal(1.625, 2)).toBe("1,63");
    expect(formatDecimal(12.4, 0)).toBe("12");
  });

  it("writes no thousands separator", () => {
    expect(formatDecimal(12345.6)).toBe("12345,6");
  });

  it("writes negative zero as 0", () => {
    expect(formatDecimal(-0.01)).toBe("0,0");
  });
});

describe("formatThousands", () => {
  it("separates thousands with a dot, from four digits on", () => {
    expect(formatThousands(6370)).toBe("6.370");
    expect(formatThousands(25480)).toBe("25.480");
    expect(formatThousands(637)).toBe("637");
  });
});

describe("formatUpTo", () => {
  it("keeps up to two decimals and drops trailing zeros", () => {
    expect(formatUpTo(9.8)).toBe("9,8");
    expect(formatUpTo(9.8 / 4)).toBe("2,45");
    expect(formatUpTo(9.8 / 100)).toBe("0,1");
  });
});

describe("the formatters of a number of decimals", () => {
  it("are built once and reused, since the animations format every frame", () => {
    formatDecimal(1.5, 3);
    formatUpTo(1.5, 3);
    const built = vi.spyOn(Intl, "NumberFormat");

    for (let frame = 0; frame < 10; frame += 1) {
      formatDecimal(frame / 7, 3);
      formatUpTo(frame / 7, 3);
    }

    expect(built).not.toHaveBeenCalled();
    built.mockRestore();
  });
});
