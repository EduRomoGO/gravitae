"use client";

// "Caída en cada planeta": boxes dropped at once from
// 30 m on three planets. Each falls y = ½·g·t² and leaves a mark every
// second, so the growing gaps show g as an acceleration.

import { useRef, type ReactElement } from "react";
import {
  BUTTON_PRIMARY,
  useFrameClock,
  writeText,
} from "@/components/learn/experiments/controls";
import {
  FONT,
  LINE_HEIGHT,
  Lines,
  NARROW_ZOOM,
  textWidth,
  useTextZoom,
  wrap,
} from "@/components/learn/experiments/text-zoom";
import { formatDecimal } from "@/lib/format";
import {
  DROP_HEIGHT_M,
  fallTime,
  SURFACE_G,
  type Astro,
} from "@/lib/gravitation/figures";
import {
  Experiment,
  EXPERIMENT_TEXT_CLASS,
} from "@/components/learn/experiments/experiment";

const HEIGHT_M = DROP_HEIGHT_M;
const WIDTH = 560;
const PX_PER_M = 8.6;
/** The marks hang left of a guide this far left of each box. */
const GUIDE = 30;
const BOX = 18;
/** Height of the strip of ground under each column. */
const GROUND_STRIP = 10;
const TIME_LABEL = "Tiempo hasta el suelo";
const DURATION = 6.3;
const MARK_EVERY = 1;

/** The astros the boxes fall on: the Moon, the Earth and Jupiter. */
const DROP_ASTROS = [
  "Luna",
  "Tierra",
  "Júpiter",
] as const satisfies readonly Astro[];
const NARROW_TEXT = 1.2;

const fallen = (g: number, t: number) => Math.min(HEIGHT_M, 0.5 * g * t * t);
const landingTime = (g: number) => fallTime(g);
const gLabel = (g: number) => `g = ${formatDecimal(g)} m/s²`;
const speedLabel = (g: number, t: number) =>
  `${formatDecimal(g * Math.min(t, landingTime(g)))} m/s`;

/**
 * What changes the drawing beyond the boxes and their speeds: whether the
 * boxes have left, the seconds marked and the boxes landed.
 */
function stageOf(t: number): string {
  const landed = DROP_ASTROS.filter(
    (astro) => t >= landingTime(SURFACE_G[astro]),
  ).length;
  return `${String(t > 0)}:${String(Math.floor(t / MARK_EVERY))}:${String(landed)}`;
}

/**
 * Seconds whose mark gets a label: on the Moon the first marks lie a few
 * units apart, so a mark too close to the last labelled one stays bare.
 */
function labelledSeconds(
  marks: readonly { t: number; y: number }[],
  room: number,
): Set<number> {
  const labelled = new Set<number>();
  let last = Number.NEGATIVE_INFINITY;
  for (const mark of marks) {
    if (mark.y - last < room) continue;
    labelled.add(mark.t);
    last = mark.y;
  }
  return labelled;
}

export function DropRace(): ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoom = useTextZoom(svgRef, WIDTH);
  // On a narrow screen the text grows a fifth over its size in pixels.
  const textZoom = zoom >= NARROW_ZOOM ? zoom * NARROW_TEXT : zoom;

  // Labels keep their size in pixels, so the drawing makes room for them.
  const name = FONT.value * textZoom;
  const small = FONT.small * textZoom;
  const value = FONT.value * textZoom;
  // The columns leave room on the left for the labels of the first guide.
  const pad = Math.max(
    0,
    GUIDE + 10 + textWidth("0 s", small) + 2 - WIDTH / DROP_ASTROS.length / 2,
  );
  const column = (WIDTH - pad) / DROP_ASTROS.length;
  const maxWidth = column - 8;
  const gLines = Math.max(
    ...DROP_ASTROS.map(
      (n) => wrap(gLabel(SURFACE_G[n]), small, maxWidth).length,
    ),
  );
  const nameY = name;
  const gY = nameY + small * 1.3;
  // The box starts right under the header, its bottom on the start line.
  const top = gY + (gLines - 1) * small * LINE_HEIGHT + small * 0.4 + BOX + 6;
  const ground = top + HEIGHT_M * PX_PER_M;
  const speedLabelY = ground + GROUND_STRIP + small * 1.4;
  const speedY = speedLabelY + value * LINE_HEIGHT;
  const timeLabel = wrap(TIME_LABEL, small, maxWidth);
  const timeLabelY = speedY + small * 1.6;
  const timeY =
    timeLabelY +
    (timeLabel.length - 1) * small * LINE_HEIGHT +
    value * LINE_HEIGHT;
  const height = timeY + 8;
  const boxY = (g: number, t: number) => top + fallen(g, t) * PX_PER_M - BOX;

  const { time, running, start } = useFrameClock({
    until: DURATION,
    stageOf,
    draw: (t) => {
      const svg = svgRef.current;
      if (!svg) return;
      for (const astro of DROP_ASTROS) {
        const g = SURFACE_G[astro];
        svg
          .querySelector(`[data-box="${astro}"]`)
          ?.setAttribute("y", String(boxY(g, t)));
        writeText(
          svg.querySelector(`[data-speed="${astro}"]`),
          speedLabel(g, t),
        );
      }
    },
  });

  return (
    <Experiment>
      <svg
        ref={svgRef}
        role="img"
        viewBox={`0 0 ${String(WIDTH)} ${String(height)}`}
        className="w-full"
      >
        <title>Caída de tres cajas en tres planetas</title>
        {DROP_ASTROS.map((astro, i) => {
          const g = SURFACE_G[astro];
          const x = pad + column * i + column / 2;
          const marks = Array.from(
            { length: Math.floor(Math.min(time, landingTime(g)) / MARK_EVERY) },
            (_, k) => ({
              t: (k + 1) * MARK_EVERY,
              y: top + fallen(g, (k + 1) * MARK_EVERY) * PX_PER_M,
            }),
          );
          const labelled = labelledSeconds(marks, small * 1.1);
          return (
            <g key={astro}>
              <text
                x={x}
                y={nameY}
                textAnchor="middle"
                style={{ fontSize: name }}
                className="fill-current font-semibold"
              >
                {astro}
              </text>
              <Lines
                lines={wrap(gLabel(g), small, maxWidth)}
                x={x}
                y={gY}
                fontSize={small}
                textAnchor="middle"
                className="fill-slate-600 dark:fill-slate-400"
              />
              <line
                x1={x - GUIDE}
                y1={top}
                x2={x - GUIDE}
                y2={ground}
                className="stroke-slate-300 dark:stroke-slate-700"
              />
              {marks.map((mark) => (
                <g key={mark.t}>
                  <line
                    x1={x - GUIDE - 6}
                    y1={mark.y}
                    x2={x - GUIDE + 6}
                    y2={mark.y}
                    strokeWidth={2}
                    className="stroke-amber-600"
                  />
                  {labelled.has(mark.t) && (
                    <text
                      x={x - GUIDE - 10}
                      y={mark.y + small * 0.35}
                      textAnchor="end"
                      style={{ fontSize: small }}
                      className="fill-amber-700 dark:fill-amber-300"
                    >
                      {mark.t} s
                    </text>
                  )}
                </g>
              ))}
              <rect
                data-box={astro}
                x={x - BOX / 2}
                y={boxY(g, time)}
                width={BOX}
                height={BOX}
                rx={3}
                className="fill-slate-700 dark:fill-slate-300"
              />
              <rect
                x={pad + column * i + 6}
                y={ground}
                width={column - 12}
                height={GROUND_STRIP}
                rx={3}
                className="fill-slate-400"
              />
              <text
                x={x}
                y={speedLabelY}
                textAnchor="middle"
                style={{ fontSize: small }}
                className="fill-slate-600 dark:fill-slate-400"
              >
                Velocidad
              </text>
              <text
                data-speed={astro}
                x={x}
                y={speedY}
                textAnchor="middle"
                style={{ fontSize: value }}
                className="fill-current font-semibold tabular-nums"
              >
                {speedLabel(g, time)}
              </text>
              {time >= landingTime(g) && (
                <>
                  <Lines
                    lines={timeLabel}
                    x={x}
                    y={timeLabelY}
                    fontSize={small}
                    textAnchor="middle"
                    className="fill-slate-600 dark:fill-slate-400"
                  />
                  <text
                    x={x}
                    y={timeY}
                    textAnchor="middle"
                    style={{ fontSize: value }}
                    className="fill-current font-semibold tabular-nums"
                  >
                    {`${formatDecimal(landingTime(g))} s`}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <button
        type="button"
        className={BUTTON_PRIMARY}
        disabled={running}
        onClick={start}
      >
        {time > 0 ? "Soltar otra vez" : "Soltar"}
      </button>
      <p className={EXPERIMENT_TEXT_CLASS}>
        <em>g</em> es la aceleración con la que la gravedad de un planeta atrae
        a los cuerpos en caída libre. En la Tierra vale{" "}
        {formatDecimal(SURFACE_G.Tierra)} m/s², lo que significa que cada
        segundo que pasa, un objeto en caída libre aumenta su velocidad en{" "}
        {formatDecimal(SURFACE_G.Tierra)} m/s. En la Luna, al ser menor la
        gravedad, esa aceleración es de solo {formatDecimal(SURFACE_G.Luna)}{" "}
        m/s². Su velocidad en cada instante es <em>v</em> = <em>g</em> ×{" "}
        <em>t</em>.
      </p>
    </Experiment>
  );
}
