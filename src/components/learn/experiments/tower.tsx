"use client";

// "Dinamómetro que sube": a 1 kg object on a spring
// scale inside a lift that climbs from the Earth's surface. At r Earth radii
// from the centre the weight is 9,8 / r² N.

import { useRef, type ReactElement } from "react";
import {
  SpringGauge,
  springGaugeLayout,
  useBounce,
} from "@/components/learn/experiments/controls";
import {
  FONT,
  LINE_HEIGHT,
  Lines,
  NARROW_ZOOM,
  textWidth,
  useTextZoom,
} from "@/components/learn/experiments/text-zoom";
import { formatDecimal, formatThousands, formatUpTo } from "@/lib/format";
import {
  EARTH_RADIUS_KM,
  SURFACE_G as ASTRO_SURFACE_G,
} from "@/lib/gravitation/figures";
import { weightAtDistance } from "@/lib/gravitation/law";
import { useRegisterWidget } from "@/components/learn/lesson-controller";
import { useWidgetState } from "@/components/learn/lesson/lesson-widget";
import { TOWER_MAX_DISTANCE } from "@/lib/lesson/widgets";
import { Experiment } from "@/components/learn/experiments/experiment";

const WIDTH = 560;
const HEIGHT = 400;
/** The lift climbs to three Earth radii from the centre, one mark per radius. */
const MAX_R = TOWER_MAX_DISTANCE;
const R_PX = 84;
// A tenth, not a fifth as in the other drawings: from FONT.small = 12 px it
// gives the 13,2 px the distances can take beside the Earth on a phone.
const NARROW_TEXT = 1.1;
const SURFACE_G = ASTRO_SURFACE_G.Tierra;
const GAUGE = { pxPerN: 24, maxN: 10, tickN: 1 } as const;
/** The weight label at its widest, which sets the width of the gauge. */
const WIDEST_LABEL = ["masa: 1 kg", "peso: 0,00 N"] as const;
export function Tower(): ReactElement {
  const [{ distance: rawR }, update] = useWidgetState("ascensor", {
    distance: 1,
  });
  const setR = (distance: number) => {
    update(() => ({ distance }));
  };
  const frame = useRegisterWidget("ascensor", { distance: rawR }, (next) => {
    update(() => next);
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const zoom = useTextZoom(svgRef, WIDTH);
  const narrow = zoom >= NARROW_ZOOM;
  const r = Math.min(rawR, MAX_R);
  const weight = weightAtDistance(SURFACE_G, r);
  const shown = useBounce(weight);

  // The frame "inside the lift" hugs the gauge against the left edge; the
  // Earth sits right of it, as far right as the buttons and the distances
  // allow, so the dashed link to the frame crosses no label. The ×N marks are
  // buttons that send the lift there. On a narrow screen the text grows a
  // tenth over its size in pixels.
  const textZoom = narrow ? zoom * NARROW_TEXT : zoom;
  const small = FONT.small * textZoom;
  const label = FONT.label * textZoom;
  const cabin = {
    width: Math.min(16 * zoom, 34),
    height: Math.min(14 * zoom, R_PX - 8),
  };
  const gauge = springGaugeLayout({
    ...GAUGE,
    label: WIDEST_LABEL,
    zoom: textZoom,
  });
  const captionY = small + 2;
  const frameTop = captionY + 6;
  const gaugeTop = frameTop + 20;
  const frameBottom =
    gaugeTop +
    gauge.rest +
    Math.max(GAUGE.maxN, SURFACE_G) * GAUGE.pxPerN +
    gauge.boxHeight +
    8;
  const height = Math.max(HEIGHT, frameBottom + 4);
  /** Centre of the Earth, high enough for the whole globe to fit. */
  const CY = height - R_PX - 8;
  const cabinY = (level: number) => CY - R_PX * level;
  const y = cabinY(r);

  const frameLeft = 4;
  const gaugeX = frameLeft + 12 + gauge.boxWidth / 2;
  const frameRight = gaugeX + gauge.right + 8;
  const distanceLines = Array.from({ length: MAX_R }, (_, k) => [
    `${formatThousands(EARTH_RADIUS_KM * (k + 1))} km`,
    "del centro",
  ]);
  const distanceWidth = Math.max(
    ...distanceLines.flat().map((line) => textWidth(line, small)),
  );
  const pill = {
    width: textWidth(`×${String(MAX_R)}`, label) + 18,
    height: label * 1.6,
  };
  const axisGap = Math.max(14, cabin.width / 2) + 8;
  const CX = Math.max(
    frameRight + 12 + R_PX,
    WIDTH - 6 - distanceWidth - 8 - pill.width - axisGap,
  );
  const PILL_X = CX + axisGap;
  const DISTANCE_X = PILL_X + pill.width + 8;

  return (
    <Experiment
      frame={frame}
      instructions={
        <>
          Un cuerpo de 1 kg pende de un dinamómetro dentro de una cabina de
          ascensor. Utiliza los botones de control (×1, ×2, ×3) para cambiar la
          posición del ascensor, teniendo en cuenta que cada nivel se encuentra
          a un radio de la Tierra más de distancia respecto al centro del
          planeta.
        </>
      }
    >
      {/* The drawing holds the marks' buttons, so it is not an image. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${String(WIDTH)} ${String(height)}`}
        className="w-full select-none"
      >
        <title>{`Ascensor a ${String(r)} radios del centro de la Tierra`}</title>
        <circle cx={CX} cy={CY} r={R_PX} className="fill-emerald-700" />
        <circle cx={CX} cy={CY} r={3} className="fill-white" />
        <text
          x={CX}
          y={CY + R_PX * 0.45}
          textAnchor="middle"
          style={{ fontSize: FONT.value * textZoom }}
          className="fill-white font-semibold"
        >
          Tierra
        </text>
        <line
          x1={CX}
          y1={CY}
          x2={CX}
          y2={cabinY(MAX_R) - 10}
          strokeWidth={3}
          className="stroke-slate-400"
        />
        {Array.from({ length: MAX_R }, (_, k) => {
          const level = k + 1;
          const active = level === r;
          const markY = cabinY(level);
          const lines = distanceLines[k] ?? [];
          return (
            <g key={level}>
              <line
                x1={CX - 10}
                y1={markY}
                x2={CX + 10}
                y2={markY}
                className="stroke-slate-500"
              />
              <g
                role="button"
                tabIndex={0}
                aria-label={`Llevar el ascensor a ×${String(level)}`}
                aria-pressed={active}
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-blue-600 [&:focus-visible>rect]:stroke-[3]"
                onClick={() => {
                  setR(level);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setR(level);
                  }
                }}
              >
                <rect
                  x={PILL_X}
                  y={markY - pill.height / 2}
                  width={pill.width}
                  height={pill.height}
                  rx={pill.height / 2}
                  strokeWidth={2}
                  className={
                    active
                      ? "fill-fuchsia-700 stroke-fuchsia-700"
                      : "fill-white stroke-fuchsia-700 dark:fill-slate-900"
                  }
                />
                <text
                  x={PILL_X + pill.width / 2}
                  y={markY + label * 0.35}
                  textAnchor="middle"
                  style={{ fontSize: label }}
                  className={`font-semibold ${active ? "fill-white" : "fill-fuchsia-700 dark:fill-fuchsia-300"}`}
                >
                  ×{level}
                </text>
              </g>
              <Lines
                lines={lines}
                x={DISTANCE_X}
                // Centred on its mark.
                y={
                  markY +
                  small * 0.35 -
                  (lines.length - 1) * small * LINE_HEIGHT * 0.5
                }
                fontSize={small}
                className="fill-slate-600 dark:fill-slate-400"
              />
            </g>
          );
        })}
        <rect
          x={CX - cabin.width / 2}
          y={y - cabin.height}
          width={cabin.width}
          height={cabin.height}
          rx={3}
          className="fill-fuchsia-700 transition-[y] duration-300"
        />
        <line
          x1={CX - cabin.width / 2}
          y1={y - cabin.height / 2}
          x2={frameRight}
          y2={gaugeTop}
          strokeDasharray="3 3"
          className="stroke-fuchsia-400"
        />
        <rect
          x={frameLeft}
          y={frameTop}
          width={frameRight - frameLeft}
          height={frameBottom - frameTop}
          rx={8}
          fill="none"
          strokeDasharray="5 4"
          className="stroke-fuchsia-500"
        />
        <text
          x={(frameLeft + frameRight) / 2}
          y={captionY}
          textAnchor="middle"
          style={{ fontSize: small }}
          className="fill-fuchsia-700 dark:fill-fuchsia-300"
        >
          Dentro del ascensor
        </text>
        <line
          x1={gaugeX}
          y1={frameTop + 8}
          x2={gaugeX}
          y2={gaugeTop}
          strokeWidth={2}
          className="stroke-slate-600"
        />
        <SpringGauge
          x={gaugeX}
          top={gaugeTop}
          weight={shown}
          {...GAUGE}
          label={["masa: 1 kg", `peso: ${formatUpTo(weight)} N`]}
          widestLabel={WIDEST_LABEL}
          zoom={textZoom}
        />
      </svg>
      <div className="space-y-1 text-base sm:text-sm">
        <p className="text-base font-semibold">
          Peso de 1 kg: {formatDecimal(SURFACE_G)} ÷ ({r} × {r}) ={" "}
          {formatUpTo(weight)} N
        </p>
        <p>
          Al doblar la distancia al centro, el peso se queda en la cuarta parte,
          y al triplicarla, en la novena. La masa del objeto sigue siendo 1 kg.
        </p>
      </div>
    </Experiment>
  );
}
