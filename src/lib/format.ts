/**
 * Every number the visitor reads, in Spanish notation: decimal comma, a dot
 * between thousands only where `formatThousands` asks for it, and no "-0".
 */

const LOCALE = "es-ES";

/**
 * One formatter per number of decimals, built on first use: the experiments'
 * animations format their readouts every frame, and building an
 * `Intl.NumberFormat` costs far more than formatting with one.
 */
function memoizedByDigits(
  build: (digits: number) => Intl.NumberFormat,
): (digits: number) => Intl.NumberFormat {
  const built = new Map<number, Intl.NumberFormat>();
  return (digits) => {
    let formatter = built.get(digits);
    if (!formatter) {
      formatter = build(digits);
      built.set(digits, formatter);
    }
    return formatter;
  };
}

const fixedDecimals = memoizedByDigits(
  (digits) =>
    new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: false,
      signDisplay: "negative",
    }),
);

const upToDecimals = memoizedByDigits(
  (digits) =>
    new Intl.NumberFormat(LOCALE, {
      maximumFractionDigits: digits,
      useGrouping: false,
      signDisplay: "negative",
    }),
);

const twoDecimals = fixedDecimals(2);
const oneDecimal = fixedDecimals(1);

/** Up to the 10 decimals of the sources; trailing zeros dropped. */
const coordinate = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 10,
  useGrouping: false,
  signDisplay: "negative",
});

const speed = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 2,
  useGrouping: false,
});

const thousands = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
  useGrouping: "always",
});

/** A simulation time, such as the period of a solution: "6,33". */
export function formatSimulationTime(time: number): string {
  return twoDecimals.format(time);
}

/** The time of the lap in progress, in tenths only: hundredths change too fast to read while the orbit plays. "2,4". */
export function formatLapTime(time: number): string {
  return oneDecimal.format(time);
}

/**
 * A coordinate of an initial condition, with the typographic minus sign:
 * "−0,6942337762". Rounding to 10 decimals removes the binary noise of
 * products like -2 · vx.
 */
export function formatCoordinate(value: number): string {
  return coordinate
    .formatToParts(value)
    .map((part) => (part.type === "minusSign" ? "−" : part.value))
    .join("");
}

/**
 * A small scientific value, such as the distance of a return: "3,1 · 10⁻⁸".
 * Values from 0,01 on keep up to four decimals.
 */
export function formatSmall(value: number): string {
  if (value === 0) return "0";
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  if (exponent >= -2) return formatCoordinate(Number(value.toFixed(4)));
  const mantissa = value / 10 ** exponent;
  const superscript = String(exponent)
    .replace("-", "⁻")
    .replace(/\d/g, (digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(digit)] ?? digit);
  return `${formatCoordinate(Number(mantissa.toFixed(1)))} · 10${superscript}`;
}

/** A playback speed multiplier: "0,5×". */
export function formatPlaybackSpeed(multiplier: number): string {
  return `${speed.format(multiplier)}×`;
}

/** A measured quantity with a fixed number of decimals: "9,8". */
export function formatDecimal(value: number, digits = 1): string {
  return fixedDecimals(digits).format(value);
}

/**
 * A measured quantity with up to `digits` decimals and no trailing zeros, so
 * a value that also appears rounded to fewer decimals reads alike: "9,8",
 * "2,45".
 */
export function formatUpTo(value: number, digits = 2): string {
  return upToDecimals(digits).format(value);
}

/** A whole number with a dot between thousands, also for four digits: "6.370". */
export function formatThousands(value: number): string {
  return thousands.format(value);
}
