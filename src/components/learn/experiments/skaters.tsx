"use client";

// "Patinadores que se empujan": two skaters on ice push
// each other. Each receives the same force, 200 N for 0,3 s, in opposite
// directions (third law); each one's speed is that push divided by its own
// mass (second law), so the lighter one glides away faster. Each skater's
// mass is set with the + and − drawn on its own body; on a narrow screen,
// where a body is too small to hold them, with two steppers under the
// drawing and the mass written over each head.

import { useRef, type CSSProperties, type ReactElement } from "react";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  Stepper,
  useFrameClock,
  writeText,
} from "@/components/learn/experiments/controls";
import { useRegisterWidget } from "@/components/learn/lesson-controller";
import { useWidgetState } from "@/components/learn/lesson/lesson-widget";
import {
  FONT,
  NARROW_ZOOM,
  textWidth,
  useTextZoom,
} from "@/components/learn/experiments/text-zoom";
import { formatDecimal, formatUpTo } from "@/lib/format";
import {
  SKATER_MAX_KG as MAX_KG,
  SKATER_MIN_KG as MIN_KG,
  SKATER_STEP_KG as STEP_KG,
} from "@/lib/lesson/widgets";
import {
  acceleration,
  distanceAfterPush,
  speedAfterPush,
  type Push,
} from "@/lib/gravitation/law";
import {
  Experiment,
  EXPERIMENT_TEXT_CLASS,
} from "@/components/learn/experiments/experiment";

const FORCE = 200;
const PUSH_TIME = 0.3;
const DURATION = 4;
const WIDTH = 560;
const MIN_HEIGHT = 285;
const CENTER = WIDTH / 2;
const ICE_Y = 200;
const PX_PER_M = 20;
const COLOR_A = "text-blue-700 dark:text-blue-400";
const COLOR_B = "text-slate-700 dark:text-slate-400";
/** Length of a second's mark under the ice. */
const MARK_LENGTH = 14;

/** The push each skater receives. */
const PUSH: Push = { forceN: FORCE, durationS: PUSH_TIME };

/** Distance travelled in metres after `t` seconds by a skater of mass `m`. */
const travelled = (m: number, t: number) => distanceAfterPush(PUSH, m, t);

/** Speed in m/s once the push is over. */
const finalSpeed = (m: number) => speedAfterPush(PUSH, m);

/** Body size in viewBox units: on a wide screen, big enough at 20 kg to hold the controls. */
function bodySize(kg: number): { w: number; h: number; r: number } {
  const t = (kg - MIN_KG) / (MAX_KG - MIN_KG);
  return { w: 48 + 24 * t, h: 104 + 36 * t, r: 13 + 5 * t };
}

/** Top of the head of a skater of `kg`. */
function headTop(kg: number): number {
  const { h, r } = bodySize(kg);
  return ICE_Y - h - 2 - 2 * r;
}

/** Vertical layout of the drawing at `zoom`, whose labels keep their size in pixels. */
function layout(zoom: number, narrow: boolean) {
  const small = FONT.small * zoom;
  const value = FONT.value * zoom;
  const label = FONT.label * zoom;
  const markLabelY = ICE_Y + MARK_LENGTH + small;
  const distanceY = markLabelY + small * 0.3 + 12;
  const distanceLabelY = distanceY + 4 + value;
  // Narrow, the masses stand over the heads and the force label over them.
  const massY = (kg: number) => headTop(kg) - 6;
  const forceY = narrow
    ? headTop(MAX_KG) - 6 - value - 8
    : Math.max(16, label * 0.9 + 4);
  // Wide, the viewBox starts at 0: the controls on the bodies are placed in
  // shares of its height.
  const top = narrow ? forceY - label * 0.9 - 4 : 0;
  const bottom = Math.max(MIN_HEIGHT, distanceLabelY + value * 0.3 + 6);
  return {
    small,
    value,
    label,
    markLabelY,
    distanceY,
    distanceLabelY,
    massY,
    forceY,
    top,
    height: bottom - top,
    /** Horizontal room a second's label needs. */
    labelRoom: textWidth("0 s", small) + 6,
  };
}
type Layout = ReturnType<typeof layout>;

/** A length in viewBox units as a share of the drawing's width. */
const cqw = (units: number) => `${String((units / WIDTH) * 100)}cqw`;

const translateX = (x: number) => `translate(${String(x)} 0)`;
const timeLabel = (t: number) => `t = ${formatDecimal(t)} s`;

/** A skater drawn around x = 0, moved into place by the group around it. */
function Skater({ kg, color }: { kg: number; color: string }): ReactElement {
  const { w, h, r } = bodySize(kg);
  return (
    <g className={color}>
      <circle cx={0} cy={ICE_Y - h - 2 - r} r={r} fill="currentColor" />
      <rect
        x={-w / 2}
        y={ICE_Y - h}
        width={w}
        height={h - 8}
        rx={8}
        fill="currentColor"
      />
      <line
        x1={-w / 2 - 4}
        y1={ICE_Y - 2}
        x2={w / 2 + 4}
        y2={ICE_Y - 2}
        strokeWidth={3}
        stroke="currentColor"
      />
    </g>
  );
}

/** The CSS left of a skater's mass control, over its body at `x`. */
function massControlLeft(x: number, kg: number): string {
  return `${String(((x - bodySize(kg).w / 2) / WIDTH) * 100)}%`;
}

/** + on top, the mass in the middle and − below, laid over a skater's body. */
function MassControl({
  x,
  kg,
  name,
  height,
  onChange,
}: {
  x: number;
  kg: number;
  name: string;
  /** Height of the drawing, whose viewBox starts at 0. */
  height: number;
  onChange: (kg: number) => void;
}): ReactElement {
  const { h, w } = bodySize(kg);
  const top = ICE_Y - h + 4;
  const bottom = ICE_Y - 12;
  const box: CSSProperties = {
    left: massControlLeft(x, kg),
    top: `${String((top / height) * 100)}%`,
    width: `${String((w / WIDTH) * 100)}%`,
    height: `${String(((bottom - top) / height) * 100)}%`,
  };
  const button: CSSProperties = {
    width: cqw(24),
    height: cqw(24),
    fontSize: cqw(16),
  };
  const label = `Masa (${name})`;
  return (
    <div
      data-mass-control={name}
      className="absolute flex flex-col items-center justify-between text-white dark:text-slate-950"
      style={box}
    >
      <button
        type="button"
        className="rounded-full border border-white/70 dark:border-slate-950/60 leading-none disabled:opacity-30"
        style={button}
        disabled={kg >= MAX_KG}
        onClick={() => {
          onChange(kg + STEP_KG);
        }}
        aria-label={`Más: ${label}`}
      >
        +
      </button>
      <span
        className="flex flex-col items-center leading-tight font-semibold tabular-nums"
        style={{ fontSize: cqw(13) }}
      >
        {kg}
        <span style={{ fontSize: cqw(10) }}>kg</span>
      </span>
      <button
        type="button"
        className="rounded-full border border-white/70 dark:border-slate-950/60 leading-none disabled:opacity-30"
        style={button}
        disabled={kg <= MIN_KG}
        onClick={() => {
          onChange(kg - STEP_KG);
        }}
        aria-label={`Menos: ${label}`}
      >
        −
      </button>
    </div>
  );
}

/** The text of a distance and where its label goes, centred under its line. */
function distanceLabel(
  from: number,
  to: number,
  metres: number,
  sizes: Layout,
): { text: string; x: number } {
  const text = `${formatDecimal(metres, 2)} m`;
  // Centred under its line, but never across the centre, where the label of
  // the other skater starts.
  const half = textWidth(text, sizes.value) / 2 + 4;
  const mid = (from + to) / 2;
  return {
    text,
    x: to < from ? Math.min(mid, CENTER - half) : Math.max(mid, CENTER + half),
  };
}

/** Writes a distance drawn by `Distance` for a skater now at `to`. */
function drawDistance(
  group: Element | null,
  from: number,
  to: number,
  metres: number,
  sizes: Layout,
) {
  if (!group) return;
  const label = distanceLabel(from, to, metres, sizes);
  const end = group.querySelector("[data-end]");
  end?.setAttribute("x1", String(to));
  end?.setAttribute("x2", String(to));
  group.querySelector("[data-span]")?.setAttribute("x2", String(to));
  const text = group.querySelector("text");
  text?.setAttribute("x", String(label.x));
  writeText(text, label.text);
}

/** Dimension line under the ice from a skater's start to where it is now. */
function Distance({
  name,
  from,
  to,
  metres,
  sizes,
}: {
  name: string;
  from: number;
  to: number;
  metres: number;
  sizes: Layout;
}): ReactElement {
  const y = sizes.distanceY;
  const label = distanceLabel(from, to, metres, sizes);
  return (
    <g
      data-distance={name}
      className="fill-emerald-700 stroke-emerald-700 dark:fill-emerald-300 dark:stroke-emerald-300"
    >
      <line x1={from} y1={y - 5} x2={from} y2={y + 5} strokeWidth={1.5} />
      <line data-end x1={to} y1={y - 5} x2={to} y2={y + 5} strokeWidth={1.5} />
      <line data-span x1={from} y1={y} x2={to} y2={y} strokeWidth={1.5} />
      <text
        x={label.x}
        y={sizes.distanceLabelY}
        textAnchor="middle"
        stroke="none"
        style={{ fontSize: sizes.value }}
        className="font-semibold tabular-nums"
      >
        {label.text}
      </text>
    </g>
  );
}

/**
 * One mark per elapsed second at `x(second)`; a mark is labelled only when
 * it stands far enough from the last labelled one, so labels never overlap.
 */
function secondMarks(
  seconds: number,
  x: (second: number) => number,
  room: number,
): { second: number; mx: number; labelled: boolean }[] {
  const marks = [];
  let lastLabelled = Number.NEGATIVE_INFINITY;
  for (let second = 1; second <= seconds; second++) {
    const mx = x(second);
    const labelled = Math.abs(mx - lastLabelled) >= room;
    if (labelled) lastLabelled = mx;
    marks.push({ second, mx, labelled });
  }
  return marks;
}

function SecondMarks({
  seconds,
  x,
  sizes,
}: {
  seconds: number;
  x: (second: number) => number;
  sizes: Layout;
}): ReactElement {
  const marks = secondMarks(seconds, x, sizes.labelRoom);
  return (
    <g>
      {marks.map(({ second, mx, labelled }) => (
        <g key={second}>
          <line
            x1={mx}
            y1={ICE_Y}
            x2={mx}
            y2={ICE_Y + MARK_LENGTH}
            strokeWidth={2}
            className="stroke-amber-600"
          />
          {labelled && (
            <text
              x={mx}
              y={sizes.markLabelY}
              textAnchor="middle"
              style={{ fontSize: sizes.small }}
              className="fill-amber-700 dark:fill-amber-300"
            >
              {second} s
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function Arrow({ from, dir }: { from: number; dir: 1 | -1 }): ReactElement {
  const y = ICE_Y - 60;
  const tip = from + dir * 50;
  const head = from + dir * 38;
  return (
    <polygon
      points={[
        [from, y - 3],
        [head, y - 3],
        [head, y - 9],
        [tip, y],
        [head, y + 9],
        [head, y + 3],
        [from, y + 3],
      ]
        .map(([px, py]) => `${String(px)},${String(py)}`)
        .join(" ")}
    />
  );
}

export function Skaters(): ReactElement {
  const [masses, update] = useWidgetState("patinadores", {
    massA: 40,
    massB: 100,
  });
  const { massA: kgA, massB: kgB } = masses;
  const frameRef = useRef<HTMLDivElement>(null);
  const zoom = useTextZoom(frameRef, WIDTH);
  const narrow = zoom >= NARROW_ZOOM;
  const sizes = layout(zoom, narrow);

  // Each one starts with its hands touching the other's at the centre.
  const startA = CENTER - bodySize(kgA).w / 2;
  const startB = CENTER + bodySize(kgB).w / 2;
  const xAt = (t: number) => ({
    a: startA - travelled(kgA, t) * PX_PER_M,
    b: startB + travelled(kgB, t) * PX_PER_M,
  });

  // Each frame moves the skaters and their distances on the DOM; React
  // renders only on a new second's mark, when the push ends and when they stop.
  const clock = useFrameClock({
    until: DURATION,
    stageOf: (t) =>
      `${String(t > 0)}:${String(Math.floor(t))}:${String(t < PUSH_TIME)}`,
    draw: (t) => {
      const frame = frameRef.current;
      if (!frame) return;
      const { a, b } = xAt(t);
      for (const [name, x, start, kg] of [
        ["izquierda", a, startA, kgA],
        ["derecha", b, startB, kgB],
      ] as const) {
        frame
          .querySelector(`[data-skater="${name}"]`)
          ?.setAttribute("transform", translateX(x));
        frame
          .querySelector(`[data-push="${name}"]`)
          ?.setAttribute("transform", translateX(x - start));
        frame
          .querySelector(`[data-mass-label="${name}"]`)
          ?.setAttribute("x", String(x));
        const control = frame.querySelector<HTMLElement>(
          `[data-mass-control="${name}"]`,
        );
        if (control) control.style.left = massControlLeft(x, kg);
        drawDistance(
          frame.querySelector(`[data-distance="${name}"]`),
          start,
          x,
          travelled(kg, t),
          sizes,
        );
      }
      writeText(
        frame.parentElement?.querySelector("[data-time]") ?? null,
        timeLabel(t),
      );
    },
  });
  const { time, running } = clock;
  const { a: xA, b: xB } = xAt(time);
  const pushing = running && time < PUSH_TIME;
  const seconds = Math.floor(time);
  const reset = clock.reset;

  const frame = useRegisterWidget("patinadores", masses, (next) => {
    reset();
    update(() => next);
  });
  function setMassA(kg: number) {
    reset();
    update((current) => ({ ...current, massA: kg }));
  }
  function setMassB(kg: number) {
    reset();
    update((current) => ({ ...current, massB: kg }));
  }

  const skaters = [
    { name: "izquierda", kg: kgA, color: COLOR_A, x: xA, setKg: setMassA },
    { name: "derecha", kg: kgB, color: COLOR_B, x: xB, setKg: setMassB },
  ];
  const heavy = Math.max(kgA, kgB);
  const light = Math.min(kgA, kgB);
  const ratio = formatUpTo(heavy / light, 1);

  return (
    <Experiment
      frame={frame}
      instructions={
        <>
          Dos patinadores quietos sobre hielo se empujan con las manos. Cambia
          la masa de cada uno con{" "}
          {narrow ? "los botones de debajo" : "el + y el − de su cuerpo"}. Cada
          segundo queda una marca en el hielo.
        </>
      }
    >
      <div
        ref={frameRef}
        className="relative"
        style={{ containerType: "inline-size" }}
      >
        <svg
          role="img"
          viewBox={`0 ${String(sizes.top)} ${String(WIDTH)} ${String(sizes.height)}`}
          className="w-full"
        >
          <title>Dos patinadores que se empujan</title>
          <rect
            x={0}
            y={ICE_Y}
            width={WIDTH}
            height={14}
            className="fill-sky-200 dark:fill-sky-900"
          />
          <SecondMarks
            seconds={seconds}
            x={(s) => startA - travelled(kgA, s) * PX_PER_M}
            sizes={sizes}
          />
          <SecondMarks
            seconds={seconds}
            x={(s) => startB + travelled(kgB, s) * PX_PER_M}
            sizes={sizes}
          />
          {time > 0 && (
            <>
              <Distance
                name="izquierda"
                from={startA}
                to={xA}
                metres={travelled(kgA, time)}
                sizes={sizes}
              />
              <Distance
                name="derecha"
                from={startB}
                to={xB}
                metres={travelled(kgB, time)}
                sizes={sizes}
              />
            </>
          )}
          <g data-skater="izquierda" transform={translateX(xA)}>
            <Skater kg={kgA} color={COLOR_A} />
          </g>
          <g data-skater="derecha" transform={translateX(xB)}>
            <Skater kg={kgB} color={COLOR_B} />
          </g>
          {narrow &&
            skaters.map(({ name, kg, color, x }) => (
              <text
                key={name}
                data-mass-label={name}
                x={x}
                y={sizes.massY(kg)}
                textAnchor="middle"
                fill="currentColor"
                style={{ fontSize: sizes.value }}
                className={`font-semibold tabular-nums ${color}`}
              >
                {kg} kg
              </text>
            ))}
          {pushing && (
            <g className="fill-fuchsia-600">
              <g data-push="izquierda" transform={translateX(xA - startA)}>
                <Arrow from={startA - bodySize(kgA).w / 2 - 4} dir={-1} />
              </g>
              <g data-push="derecha" transform={translateX(xB - startB)}>
                <Arrow from={startB + bodySize(kgB).w / 2 + 4} dir={1} />
              </g>
              <text
                x={CENTER}
                y={sizes.forceY}
                textAnchor="middle"
                style={{ fontSize: sizes.label }}
                className="font-semibold"
              >
                {FORCE} N sobre cada uno
              </text>
            </g>
          )}
        </svg>
        {!narrow &&
          skaters.map(({ name, kg, x, setKg }) => (
            <MassControl
              key={name}
              x={x}
              kg={kg}
              name={name}
              height={sizes.height}
              onChange={setKg}
            />
          ))}
      </div>
      {narrow && (
        <div className="flex flex-col gap-2">
          {skaters.map(({ name, kg, setKg }) => (
            <Stepper
              key={name}
              label={`Masa (${name})`}
              value={kg / STEP_KG}
              min={MIN_KG / STEP_KG}
              max={MAX_KG / STEP_KG}
              onChange={(steps) => {
                setKg(steps * STEP_KG);
              }}
              format={(steps) => `${String(steps * STEP_KG)} kg`}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={BUTTON_PRIMARY}
          onClick={running ? clock.stop : clock.start}
        >
          {running ? "Parar" : "Empujarse"}
        </button>
        <button type="button" className={BUTTON_SECONDARY} onClick={reset}>
          Volver a juntarse
        </button>
        <span data-time className="text-base sm:text-sm tabular-nums">
          {timeLabel(time)}
        </span>
      </div>
      <p className={EXPERIMENT_TEXT_CLASS}>
        Los dos reciben la misma fuerza: {FORCE} N durante{" "}
        {formatDecimal(PUSH_TIME)} s. Cuando acaba el empujón ya nada los frena,
        y cada uno sigue deslizándose a la velocidad con la que salió.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {skaters.map(({ name, kg, color }) => (
          <div
            key={name}
            className="space-y-1 rounded border border-slate-300 p-3 text-base sm:text-sm dark:border-slate-700"
          >
            <p className={`font-semibold ${color}`}>
              El de la {name}, {kg} kg
            </p>
            <p>
              Sale a <strong>{formatUpTo(finalSpeed(kg))} m/s</strong>
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {FORCE} N ÷ {kg} kg = {formatUpTo(acceleration(FORCE, kg), 1)}{" "}
              m/s² durante {formatDecimal(PUSH_TIME)} s
            </p>
          </div>
        ))}
      </div>
      <p className={EXPERIMENT_TEXT_CLASS}>
        {heavy === light
          ? "Tienen la misma masa, así que salen igual de rápido."
          : `El de ${String(heavy)} kg tiene ${ratio} veces la masa del de ${String(light)} kg, así que sale ${ratio} veces más despacio.`}
      </p>
    </Experiment>
  );
}
