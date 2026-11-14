"use client";

// Small controls shared by the experiments of the lesson.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  FONT,
  LINE_HEIGHT,
  textWidth,
} from "@/components/learn/experiments/text-zoom";
import { formatDecimal } from "@/lib/format";
import type { Astro } from "@/lib/gravitation/figures";
import { prefersReducedMotion } from "@/lib/reduced-motion";

const BUTTON =
  "h-8 w-8 shrink-0 rounded-full border border-slate-500 text-lg leading-none disabled:opacity-30";

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  format = (v) => `×${String(v)}`,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}): ReactElement {
  return (
    <div className="flex items-center gap-2 text-base sm:text-sm">
      <span className="min-w-28">{label}</span>
      <button
        type="button"
        className={BUTTON}
        disabled={value <= min}
        onClick={() => {
          onChange(value - 1);
        }}
        aria-label={`Menos: ${label}`}
      >
        −
      </button>
      <span className="w-14 text-center font-semibold tabular-nums">
        {format(value)}
      </span>
      <button
        type="button"
        className={BUTTON}
        disabled={value >= max}
        onClick={() => {
          onChange(value + 1);
        }}
        aria-label={`Más: ${label}`}
      >
        +
      </button>
    </div>
  );
}

/** Converts a pointer position to the x coordinate of an SVG's viewBox. */
export function svgX(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): number {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const matrix = svg.getScreenCTM();
  return matrix ? point.matrixTransform(matrix.inverse()).x : 0;
}

/**
 * Follows `target` with a damped spring, so a value change bounces. The
 * bounce only decorates the change: with reduced motion the value goes
 * straight to `target`.
 */
export function useBounce(target: number): number {
  const [shown, setShown] = useState(target);
  const position = useRef(target);
  useEffect(() => {
    let frame = 0;
    let velocity = 0;
    let last = performance.now();
    function step() {
      if (prefersReducedMotion()) {
        position.current = target;
        setShown(target);
        return;
      }
      const now = performance.now();
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      velocity += (-60 * (position.current - target) - 7 * velocity) * dt;
      position.current += velocity * dt;
      if (
        Math.abs(position.current - target) <
          0.001 * Math.max(1, Math.abs(target)) &&
        Math.abs(velocity) < 0.01
      ) {
        position.current = target;
        setShown(target);
        return;
      }
      setShown(position.current);
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target]);
  return shown;
}

const COILS = 9;

function springPath(x: number, top: number, length: number): string {
  const step = length / (COILS * 2);
  const points = [`M ${String(x)} ${String(top)}`];
  for (let i = 1; i < COILS * 2; i++) {
    points.push(
      `L ${String(x + (i % 2 === 0 ? -8 : 8))} ${String(top + step * i)}`,
    );
  }
  points.push(`L ${String(x)} ${String(top + length)}`);
  return points.join(" ");
}

const GAUGE_REST = 24;
const GAUGE_BOX = 40;
const GAUGE_RULER_GAP = 10;
const GAUGE_TICK_GAP = 9;
const GAUGE_LONG_TICK = 8;
const GAUGE_SHORT_TICK = 4;

const tickLabel = (newtons: number, tickN: number) =>
  `${formatDecimal(newtons, tickN < 1 ? 1 : 0)} N`;

/** How a `SpringGauge` draws its ruler and its box, beyond its defaults. */
export interface SpringGaugeOptions {
  /** Every how many ticks the ruler draws a long tick with its number; 2 by default. */
  labelEvery?: number;
  /** The number of a tick; its newtons with the unit by default. */
  tickText?: (newtons: number) => string;
  /** The box's smallest width; without it, wide enough for a weight's label. */
  minBoxWidth?: number;
}

/**
 * Sizes of a `SpringGauge` in viewBox units: its box grows to hold its label
 * at `zoom`, or `widestLabel` when the label changes, so the ruler stays put;
 * `rest` is the spring's length without weight, and `right` is how far its
 * ruler's labels reach right of `x`.
 */
export function springGaugeLayout({
  label,
  widestLabel = label,
  zoom = 1,
  maxN,
  tickN,
  labelEvery = 2,
  tickText = (newtons) => tickLabel(newtons, tickN),
  minBoxWidth,
}: {
  label: string | readonly string[];
  widestLabel?: string | readonly string[] | undefined;
  zoom?: number;
  maxN: number;
  tickN: number;
} & SpringGaugeOptions): {
  lines: readonly string[];
  fontSize: number;
  tickSize: number;
  boxWidth: number;
  boxHeight: number;
  rest: number;
  ticks: readonly { newtons: number; text: string | null }[];
  right: number;
} {
  const lines = typeof label === "string" ? [label] : label;
  const fontSize = (lines.length > 1 ? FONT.small : FONT.label) * zoom;
  const tickSize = FONT.small * zoom;
  const widest = typeof widestLabel === "string" ? [widestLabel] : widestLabel;
  const boxWidth = Math.max(
    minBoxWidth ?? (lines.length > 1 ? 84 : GAUGE_BOX),
    ...[...lines, ...widest].map((line) => textWidth(line, fontSize) + 12),
  );
  const boxHeight = Math.max(
    GAUGE_BOX,
    lines.length * fontSize * LINE_HEIGHT + 10,
  );
  const ticks = Array.from(
    { length: Math.floor(maxN / tickN) + 1 },
    (_, k) => ({
      newtons: k * tickN,
      text: k % labelEvery === 0 ? tickText(k * tickN) : null,
    }),
  );
  const widestTick = Math.max(
    ...ticks.map(({ text }) => (text === null ? 0 : textWidth(text, tickSize))),
  );
  return {
    lines,
    fontSize,
    tickSize,
    boxWidth,
    boxHeight,
    rest: GAUGE_REST,
    ticks,
    right: boxWidth / 2 + GAUGE_RULER_GAP + GAUGE_TICK_GAP + widestTick,
  };
}

/**
 * A spring scale hanging from `top`: spring, ruler in newtons and a box.
 * The spring stretches `pxPerN` per newton of `weight`. A `label` with
 * several lines widens the box to fit them; `zoom`, from `useTextZoom`,
 * keeps the labels readable on a small screen. Every experiment that weighs
 * with a spring scale draws it with this one.
 */
export function SpringGauge({
  x,
  top,
  weight,
  pxPerN,
  maxN,
  tickN,
  label,
  widestLabel,
  zoom = 1,
  ...options
}: {
  x: number;
  top: number;
  weight: number;
  pxPerN: number;
  maxN: number;
  tickN: number;
  label: string | readonly string[];
  widestLabel?: string | readonly string[];
  zoom?: number;
} & SpringGaugeOptions): ReactElement {
  const { lines, fontSize, tickSize, boxWidth, boxHeight, rest, ticks } =
    springGaugeLayout({ label, widestLabel, zoom, maxN, tickN, ...options });
  const length = rest + Math.max(0, Math.min(weight, maxN * 1.05)) * pxPerN;
  const boxTop = top + length;
  const rulerX = x + boxWidth / 2 + GAUGE_RULER_GAP;
  return (
    <g>
      <path
        d={springPath(x, top, length)}
        fill="none"
        strokeWidth={2}
        className="stroke-slate-700 dark:stroke-slate-300"
      />
      <line
        x1={rulerX}
        y1={top + rest}
        x2={rulerX}
        y2={top + rest + maxN * pxPerN}
        className="stroke-slate-400"
      />
      {ticks.map(({ newtons, text }) => {
        const ty = top + rest + newtons * pxPerN;
        return (
          <g key={newtons}>
            <line
              x1={rulerX}
              y1={ty}
              x2={rulerX + (text === null ? GAUGE_SHORT_TICK : GAUGE_LONG_TICK)}
              y2={ty}
              className="stroke-slate-400"
            />
            {text !== null && (
              <text
                x={rulerX + GAUGE_TICK_GAP}
                y={ty + tickSize * 0.35}
                style={{ fontSize: tickSize }}
                className="fill-slate-600 dark:fill-slate-400"
              >
                {text}
              </text>
            )}
          </g>
        );
      })}
      <polygon
        points={`${String(rulerX - 2)},${String(boxTop)} ${String(rulerX - 10)},${String(boxTop - 5)} ${String(rulerX - 10)},${String(boxTop + 5)}`}
        className="fill-blue-600 dark:fill-blue-300"
      />
      <rect
        x={x - boxWidth / 2}
        y={boxTop}
        width={boxWidth}
        height={boxHeight}
        rx={4}
        className="fill-slate-700 dark:fill-slate-300"
      />
      {lines.map((line, i) => (
        <text
          key={line}
          x={x}
          y={
            boxTop +
            boxHeight / 2 +
            fontSize * 0.35 +
            (i - (lines.length - 1) / 2) * fontSize * LINE_HEIGHT
          }
          textAnchor="middle"
          style={{ fontSize }}
          className="fill-white font-semibold tabular-nums dark:fill-slate-900"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

/** Runs a clock from 0 while `running`, stopping at `until`. */
export function useClock(
  running: boolean,
  until: number,
  onEnd: () => void,
): [number, (t: number) => void] {
  const [time, setTime] = useState(0);
  const end = useRef(onEnd);
  useEffect(() => {
    end.current = onEnd;
  });
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const startedAt = performance.now();
    function step() {
      const t = (performance.now() - startedAt) / 1000;
      if (t >= until) {
        setTime(until);
        end.current();
        return;
      }
      setTime(t);
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [running, until]);
  return [time, setTime];
}

/** What a frame clock's component renders; a new object on each change. */
export interface FrameClock {
  /**
   * The time React last rendered: the start of the current stage while it
   * runs, the time it stopped at otherwise.
   */
  readonly time: number;
  readonly running: boolean;
  /** Runs from 0. */
  readonly start: () => void;
  /** Stops where the last frame drew it. */
  readonly stop: () => void;
  /** Stops at 0. */
  readonly reset: () => void;
}

/**
 * A clock that runs from 0 to `until` for an animation that draws its own
 * frames: every frame goes to `draw`, which writes the moving parts on the
 * DOM, and the component re-renders only when `stageOf` gives a new value (a
 * second's mark, a landing) and when the clock stops. A render per frame
 * would re-render the whole experiment 60 times a second. `draw` writes what
 * the render would give for that time, so both agree whichever ran last.
 */
export function useFrameClock({
  until,
  stageOf,
  draw,
}: {
  until: number;
  stageOf: (time: number) => string;
  draw: (time: number) => void;
}): FrameClock {
  const [{ time, running }, setClock] = useState({ time: 0, running: false });
  const latest = useRef({ stageOf, draw });
  useLayoutEffect(() => {
    latest.current = { stageOf, draw };
  });
  // The time the last frame drew, where stopping leaves the clock.
  const drawn = useRef(0);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const startedAt = performance.now();
    let stage = latest.current.stageOf(0);
    function step() {
      const t = (performance.now() - startedAt) / 1000;
      if (t >= until) {
        drawn.current = until;
        setClock({ time: until, running: false });
        return;
      }
      drawn.current = t;
      latest.current.draw(t);
      const next = latest.current.stageOf(t);
      if (next !== stage) {
        stage = next;
        setClock({ time: t, running: true });
      }
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [running, until]);

  return {
    time,
    running,
    start: () => {
      drawn.current = 0;
      setClock({ time: 0, running: true });
    },
    stop: () => {
      setClock({ time: drawn.current, running: false });
    },
    reset: () => {
      drawn.current = 0;
      setClock({ time: 0, running: false });
    },
  };
}

/**
 * Sets the text of an element whose only child is a text node that React
 * renders, keeping that node: replacing it would leave React writing to a
 * node no longer on the page.
 */
export function writeText(element: Element | null, text: string): void {
  const node = element?.firstChild;
  if (node && node.nodeType === Node.TEXT_NODE && node.nodeValue !== text)
    node.nodeValue = text;
}

export const BUTTON_PRIMARY =
  "rounded bg-blue-700 px-4 py-2 text-base sm:text-sm font-semibold text-white disabled:opacity-40";
export const BUTTON_SECONDARY =
  "rounded border border-slate-400 px-4 py-2 text-base sm:text-sm";

export function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => {
            onChange(option);
          }}
          className={`rounded border px-3 py-1 text-base sm:text-sm ${
            option === value
              ? "border-fuchsia-700 bg-fuchsia-700 text-white"
              : "border-slate-400"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/** The astros of the experiments, from the weakest gravity to the strongest. */
export const ASTRO_NAMES = [
  "Luna",
  "Marte",
  "Tierra",
  "Júpiter",
] as const satisfies readonly Astro[];
