"use client";

// "Esfera que crece": the planet's influence spreads over an imaginary
// sphere centred on its centre of mass and passing through B. At distance ×d
// the sphere's radius is d times larger, so the patch B covers at ×1 is now
// d times wider and d times taller: d² patches the size of B, of which B gets
// only one. Side view on top; the patch seen from the front underneath.

import type { ReactElement } from "react";
import { Stepper } from "@/components/learn/experiments/controls";
import { formatUpTo } from "@/lib/format";
import { SURFACE_G } from "@/lib/gravitation/figures";
import { weightAtDistance } from "@/lib/gravitation/law";
import { useRegisterWidget } from "@/components/learn/lesson-controller";
import { useWidgetState } from "@/components/learn/lesson/lesson-widget";
import { SPHERE_MAX_DISTANCE as MAX_D } from "@/lib/lesson/widgets";
import {
  Experiment,
  EXPERIMENT_TEXT_CLASS,
} from "@/components/learn/experiments/experiment";

const SIZE = 400;
const C = SIZE / 2;
/** Pixels per distance step: the sphere at ×MAX_D still fits. */
const UNIT = 44;
const B_R = 10;
/** B sits on the surface at ×1. */
const PLANET_R = UNIT - B_R;
/** Half the angle B covers seen from the centre at ×1. */
const HALF_ANGLE = Math.asin(B_R / UNIT);
const CELL = 30;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function GrowingSphere(): ReactElement {
  const [{ distance: d }, update] = useWidgetState("esfera", { distance: 1 });
  const setD = (distance: number) => {
    update(() => ({ distance }));
  };
  const frame = useRegisterWidget("esfera", { distance: d }, (next) => {
    update(() => next);
  });
  const r = d * UNIT;
  const bX = C + r;
  // The patch B covers at ×1, carried out to the sphere at ×d.
  const edgeX = round2(C + r * Math.cos(HALF_ANGLE));
  const edgeDy = round2(r * Math.sin(HALF_ANGLE));
  const patches = d * d;
  const grid = d * CELL;
  const bCell = Math.floor((d - 1) / 2);

  return (
    <Experiment
      frame={frame}
      instructions={
        <>
          La atracción del planeta sale de su <strong>centro</strong> y se
          reparte sobre una esfera imaginaria que pasa por B. Aleja B y mira
          cómo crece la esfera desde ese punto.
        </>
      }
    >
      <svg
        viewBox={`0 0 ${String(SIZE)} ${String(SIZE)}`}
        className="mx-auto w-full max-w-sm"
        role="img"
        aria-label={`Vista lateral: B a distancia ×${String(d)} del centro del planeta, sobre la esfera que crece desde ese centro`}
      >
        <circle
          cx={C}
          cy={C}
          r={PLANET_R}
          className="fill-sky-600/80 dark:fill-sky-500/70"
        />
        <circle
          cx={C}
          cy={C}
          r={r}
          fill="none"
          strokeDasharray="5 4"
          strokeWidth={2}
          className="stroke-amber-600 dark:stroke-amber-400"
        />
        {/* The cone from the centre that B fills at ×1. */}
        <path
          d={`M${String(C)} ${String(C)} L${String(edgeX)} ${String(C - edgeDy)} A${String(r)} ${String(r)} 0 0 1 ${String(edgeX)} ${String(C + edgeDy)} Z`}
          className="fill-amber-400/30 stroke-amber-500"
          strokeWidth={1}
        />
        <circle cx={C} cy={C} r={3.5} className="fill-red-600" />
        <circle
          cx={bX}
          cy={C}
          r={B_R}
          className="fill-slate-800 dark:fill-slate-200"
        />
        <text
          x={bX}
          y={C - B_R - 6}
          textAnchor="middle"
          className="fill-slate-900 text-[16px] font-semibold dark:fill-slate-100"
        >
          B
        </text>
      </svg>

      <Stepper
        label="Distancia de B al centro"
        value={d}
        min={1}
        max={MAX_D}
        onChange={setD}
      />

      <div className="flex items-center gap-4">
        <svg
          viewBox={`0 0 ${String(MAX_D * CELL + 2)} ${String(MAX_D * CELL + 2)}`}
          className="w-28 shrink-0"
          role="img"
          aria-label={`El trozo de esfera de frente: ${String(patches)} ${patches === 1 ? "hueco" : "huecos"} del tamaño de B, uno ocupado por B`}
        >
          {Array.from({ length: patches }, (_, i) => {
            const row = Math.floor(i / d);
            const col = i % d;
            const offset = (MAX_D * CELL - grid) / 2 + 1;
            const isB = row === bCell && col === bCell;
            return (
              <rect
                key={i}
                x={offset + col * CELL}
                y={offset + row * CELL}
                width={CELL}
                height={CELL}
                className={
                  isB
                    ? "fill-slate-800 stroke-amber-600 dark:fill-slate-200"
                    : "fill-amber-400/30 stroke-amber-600"
                }
                strokeWidth={1}
              />
            );
          })}
        </svg>
        <p className={EXPERIMENT_TEXT_CLASS}>
          {d === 1 ? (
            <>
              El trozo amarillo, visto de frente. A ×1 B lo tapa entero: le
              llega <strong>todo</strong> y 1 kg pesa{" "}
              <strong>{formatUpTo(SURFACE_G.Tierra)} N</strong>.
            </>
          ) : (
            <>
              El mismo trozo, visto de frente. A ×{d} es {d} veces más ancho y{" "}
              {d} veces más alto: caben <strong>{patches}</strong> B. A B le
              llega <strong>1/{patches}</strong> y 1 kg pesa{" "}
              <strong>
                {formatUpTo(weightAtDistance(SURFACE_G.Tierra, d))} N
              </strong>
              .
            </>
          )}
        </p>
      </div>
    </Experiment>
  );
}
