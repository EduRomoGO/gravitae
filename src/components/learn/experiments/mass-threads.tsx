"use client";

// "Masa en bolitas e hilos": each mass is a number of
// beads and every bead of A pulls every bead of B with one thread, so the
// number of threads is mA × mB. Each thread gets thinner with 1/r², so the
// total force is threads × 1/r².

import { useRef, useState, type ReactElement } from "react";
import { useRegisterWidget } from "@/components/learn/lesson-controller";
import { useWidgetState } from "@/components/learn/lesson/lesson-widget";
import {
  factorValue,
  forceFactor,
  formatFactor,
} from "@/lib/gravitation/factors";
import { Stepper, svgX } from "@/components/learn/experiments/controls";
import { FONT, useTextZoom } from "@/components/learn/experiments/text-zoom";
import {
  THREADS_MAX_DISTANCE as MAX_DISTANCE,
  THREADS_MAX_MASS as MAX_MASS,
} from "@/lib/lesson/widgets";
import { Experiment } from "@/components/learn/experiments/experiment";

const WIDTH = 560;
const CY = 75;
const UNIT = 160;
const BODY_RADIUS = 36;
const BEAD_RADIUS = 7;
const MAX_THREAD_WIDTH = 3;

const beads = (n: number) => `${String(n)} ${n === 1 ? "bolita" : "bolitas"}`;

/** How many beads a mass can have, from 1 to THREADS_MAX_MASS. */
type BeadCount = 1 | 2 | 3 | 4;
/** Where a bead sits, from the centre of its body. */
type BeadOffset = readonly [dx: number, dy: number];

const LAYOUTS: Readonly<Record<BeadCount, readonly BeadOffset[]>> = {
  1: [[0, 0]],
  2: [
    [0, -14],
    [0, 14],
  ],
  3: [
    [-8, -16],
    [10, 0],
    [-8, 16],
  ],
  4: [
    [-12, -12],
    [12, -12],
    [-12, 12],
    [12, 12],
  ],
};

// A larger maximum mass fails to compile here until LAYOUTS lays it out.
MAX_MASS satisfies BeadCount;

const isBeadCount = (n: number): n is BeadCount => Object.hasOwn(LAYOUTS, n);

/** The beads of a mass the widget's schema accepts, from 1 to MAX_MASS. */
function layoutOf(mass: number): readonly BeadOffset[] {
  if (!isBeadCount(mass))
    throw new RangeError(`No layout for a mass of ${String(mass)} beads`);
  return LAYOUTS[mass];
}

export function MassThreads(): ReactElement {
  const [state, update] = useWidgetState("hilos", {
    massA: 2,
    massB: 3,
    distance: 1,
  });
  const { massA, massB, distance } = state;
  const setMassA = (next: number) => {
    update((current) => ({ ...current, massA: next }));
  };
  const setMassB = (next: number) => {
    update((current) => ({ ...current, massB: next }));
  };
  const setDistance = (next: number) => {
    update((current) => ({ ...current, distance: next }));
  };
  const frame = useRegisterWidget("hilos", state, (next) => {
    update(() => next);
  });
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoom = useTextZoom(svgRef, WIDTH);
  const name = FONT.value * zoom;
  const nameY = CY + BODY_RADIUS + name * 1.2;
  const height = nameY + name * 0.6;

  const separation = UNIT * distance;
  const xA = WIDTH / 2 - separation / 2;
  const xB = WIDTH / 2 + separation / 2;
  const beadsA = layoutOf(massA).map(([dx, dy]) => [xA + dx, CY + dy] as const);
  const beadsB = layoutOf(massB).map(([dx, dy]) => [xB + dx, CY + dy] as const);
  const threads = massA * massB;
  const threadWidth = MAX_THREAD_WIDTH / (distance * distance);
  const force = forceFactor({ massA, massB, distance });
  const maxForce = MAX_MASS * MAX_MASS;

  function moveB(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const x = svgX(svg, clientX, clientY);
    const d = Math.round(((x - WIDTH / 2) * 2) / UNIT);
    setDistance(Math.min(MAX_DISTANCE, Math.max(1, d)));
  }

  return (
    <Experiment
      frame={frame}
      instructions={
        <>
          Cada bolita es una unidad de masa, y cada bolita de A tira de cada
          bolita de B con un hilo. Arrastra B para alejarla.
        </>
      }
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${String(WIDTH)} ${String(Math.max(170, height))}`}
        // B is dragged sideways: a vertical swipe on the drawing scrolls the
        // page.
        className="w-full touch-pan-y select-none"
        onPointerMove={(e) => {
          if (dragging) moveB(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          setDragging(false);
        }}
        onPointerLeave={() => {
          setDragging(false);
        }}
      >
        <circle
          cx={xA}
          cy={CY}
          r={BODY_RADIUS}
          className="fill-slate-200/60 stroke-slate-500 dark:fill-slate-700/40"
        />
        <g
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            (
              e.currentTarget.ownerSVGElement ?? e.currentTarget
            ).setPointerCapture(e.pointerId);
            setDragging(true);
          }}
        >
          <circle
            cx={xB}
            cy={CY}
            r={BODY_RADIUS}
            className={`fill-slate-200/60 dark:fill-slate-700/40 ${
              dragging ? "stroke-fuchsia-600" : "stroke-slate-500"
            }`}
            strokeWidth={dragging ? 2 : 1}
          />
        </g>
        {beadsA.flatMap(([ax, ay], i) =>
          beadsB.map(([bx, by], j) => (
            <line
              key={`${String(i)}-${String(j)}`}
              x1={ax}
              y1={ay}
              x2={bx}
              y2={by}
              strokeWidth={threadWidth}
              className="stroke-blue-600 dark:stroke-blue-300"
              strokeOpacity={0.75}
              pointerEvents="none"
            />
          )),
        )}
        {[...beadsA, ...beadsB].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={BEAD_RADIUS}
            className="pointer-events-none fill-slate-800 dark:fill-slate-200"
          />
        ))}
        <text
          x={xA}
          y={nameY}
          textAnchor="middle"
          style={{ fontSize: name }}
          className="fill-current font-semibold"
        >
          A
        </text>
        <text
          x={xB}
          y={nameY}
          textAnchor="middle"
          style={{ fontSize: name }}
          className="fill-current font-semibold"
        >
          B ⇆
        </text>
      </svg>

      <div className="flex flex-col gap-2">
        <Stepper
          label="Bolitas de A"
          value={massA}
          min={1}
          max={MAX_MASS}
          onChange={setMassA}
          format={String}
        />
        <Stepper
          label="Bolitas de B"
          value={massB}
          min={1}
          max={MAX_MASS}
          onChange={setMassB}
          format={String}
        />
        <Stepper
          label="Distancia"
          value={distance}
          min={1}
          max={MAX_DISTANCE}
          onChange={setDistance}
        />
      </div>

      <div className="space-y-1 text-base sm:text-sm">
        <p>
          {beads(massA)} de A × {beads(massB)} de B ={" "}
          <strong>
            {threads} {threads === 1 ? "hilo" : "hilos"}
          </strong>
          .
        </p>
        <p>
          Cada hilo, a distancia ×{distance}, tira{" "}
          <strong>
            {distance === 1
              ? "lo mismo que al principio"
              : `1/(${String(distance)} × ${String(distance)}) = 1/${String(distance * distance)}`}
          </strong>
          .
        </p>
        <p className="text-base font-semibold">
          Fuerza: {threads} ×{" "}
          {distance === 1 ? "1" : `1/${String(distance * distance)}`} ={" "}
          {formatFactor(force)}
        </p>
        <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-800">
          <div
            className="h-3 rounded bg-blue-600 transition-all dark:bg-blue-300"
            style={{
              width: `${String((factorValue(force) / maxForce) * 100)}%`,
            }}
          />
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          La barra compara con la fuerza máxima, la de {MAX_MASS} bolitas contra{" "}
          {MAX_MASS} a distancia ×1.
        </p>
      </div>
    </Experiment>
  );
}
