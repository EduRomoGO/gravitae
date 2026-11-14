"use client";

// "Dos astronautas": two people of 70 kg float in
// empty space with 1 m between their centres and nothing else pulling them.
// Only their mutual gravitation acts, integrated with 1/r², so they do come
// together — after almost three hours. The reader picks how fast time runs.

import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  Choice,
  writeText,
} from "@/components/learn/experiments/controls";
import { useRegisterWidget } from "@/components/learn/lesson-controller";
import { useWidgetState } from "@/components/learn/lesson/lesson-widget";
import { formatDecimal } from "@/lib/format";
import { ASTRONAUT_SPEEDS as SPEEDS } from "@/lib/lesson/widgets";
import { PERSON_WEIGHT_N } from "@/lib/gravitation/figures";
import {
  approach,
  ASTRONAUTS,
  ASTRONAUTS_AT_REST as INITIAL,
  gravitationalForce,
} from "@/lib/gravitation/law";
import {
  Experiment,
  EXPERIMENT_TEXT_CLASS,
} from "@/components/learn/experiments/experiment";

const MASS = ASTRONAUTS.massKg;
const START_R = ASTRONAUTS.startM;
const CONTACT_R = ASTRONAUTS.contactM;
const WIDTH = 560;
const HEIGHT = 200;
const PX_PER_M = 200;
const SPEED_VALUE: Record<(typeof SPEEDS)[number], number> = {
  "×1": 1,
  "×60": 60,
  "×600": 600,
  "×3.600": 3600,
};
const SPEED_HINT: Record<(typeof SPEEDS)[number], string> = {
  "×1": "tiempo real",
  "×60": "cada segundo, un minuto",
  "×600": "cada segundo, diez minutos",
  "×3.600": "cada segundo, una hora",
};

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h)} h ${String(m).padStart(2, "0")} min ${String(s).padStart(2, "0")} s`;
}

/** How far each astronaut stands from the middle, in the drawing's units. */
const halfGap = (r: number) => (r * PX_PER_M) / 2;
const translateX = (x: number) => `translate(${String(x)} 0)`;
const closedMm = (r: number) => (START_R - r) * 1000;
const closedLabel = (r: number) =>
  `${formatDecimal(closedMm(r), closedMm(r) < 1 ? 3 : 1)} mm`;
const forceLabel = (r: number) =>
  `${formatDecimal(gravitationalForce(MASS, MASS, r), 9)} N`;

/** An astronaut drawn around x = 0; `side` places it left or right of the middle. */
function Person({ side }: { side: "left" | "right" }): ReactElement {
  const dir = side === "right" ? -1 : 1;
  return (
    <g
      className="fill-slate-200 stroke-slate-700 dark:fill-slate-700 dark:stroke-slate-200"
      strokeWidth={2}
    >
      <circle cx={0} cy={62} r={16} />
      <rect x={-20} y={80} width={40} height={60} rx={12} />
      <line x1={dir * 18} y1={95} x2={dir * 36} y2={118} />
      <line x1={-10} y1={140} x2={-14} y2={180} />
      <line x1={10} y1={140} x2={14} y2={180} />
      <circle cx={0} cy={110} r={3} className="fill-fuchsia-600 stroke-none" />
    </g>
  );
}

export function Astronauts(): ReactElement {
  const [state, setState] = useState(INITIAL);
  const [running, setRunning] = useState(false);
  const [{ speed }, update] = useWidgetState("astronautas", { speed: "×1" });
  // While they move, each frame is written on the DOM from here, and React
  // renders the state only when they touch or stop, or the speed changes: a
  // render per frame would re-render the whole experiment 60 times a second.
  const live = useRef(state);
  /** Renders where the last frame left them, before a render they would jump back from. */
  const settle = () => {
    setState(live.current);
  };
  const setSpeed = (next: (typeof SPEEDS)[number]) => {
    settle();
    update(() => ({ speed: next }));
  };
  const frame = useRegisterWidget("astronautas", { speed }, (next) => {
    settle();
    update(() => next);
  });
  const touching = state.r <= CONTACT_R;
  const active = running && !touching;
  const svgRef = useRef<SVGSVGElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const factor = SPEED_VALUE[speed];
    let frame = 0;
    let last = performance.now();
    function draw(r: number, t: number) {
      const half = halfGap(r);
      svgRef.current
        ?.querySelector('[data-person="left"]')
        ?.setAttribute("transform", translateX(WIDTH / 2 - half));
      svgRef.current
        ?.querySelector('[data-person="right"]')
        ?.setAttribute("transform", translateX(WIDTH / 2 + half));
      const readout = readoutRef.current;
      writeText(readout?.querySelector("[data-time]") ?? null, clock(t));
      writeText(
        readout?.querySelector("[data-closed]") ?? null,
        closedLabel(r),
      );
      writeText(readout?.querySelector("[data-force]") ?? null, forceLabel(r));
    }
    function step() {
      const now = performance.now();
      const real = Math.min(0.05, (now - last) / 1000);
      last = now;
      const next = approach(live.current, real * factor);
      live.current = next;
      if (next.r <= CONTACT_R) {
        setState(next);
        return;
      }
      draw(next.r, next.t);
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active, speed]);

  const half = halfGap(state.r);

  return (
    <Experiment
      frame={frame}
      instructions={
        <>
          En el espacio no hay suelo que te sujete ni Tierra que te atraiga. Dos
          astronautas de {MASS} kg flotan quietos, con {START_R} m entre sus
          centros (marcados con un punto), y solo se atraen entre ellos. Dale a
          «Empezar» y elige a qué velocidad pasa el tiempo.
        </>
      }
    >
      <svg
        ref={svgRef}
        role="img"
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        className="w-full rounded bg-slate-900"
      >
        <title>Dos astronautas que se atraen en el espacio</title>
        {[
          [40, 30],
          [500, 50],
          [120, 170],
          [430, 160],
          [280, 20],
          [520, 120],
        ].map(([x, y]) => (
          <circle
            key={`${String(x)}-${String(y)}`}
            cx={x}
            cy={y}
            r={1.5}
            className="fill-white"
          />
        ))}
        <g data-person="left" transform={translateX(WIDTH / 2 - half)}>
          <Person side="left" />
        </g>
        <g data-person="right" transform={translateX(WIDTH / 2 + half)}>
          <Person side="right" />
        </g>
      </svg>
      <div
        ref={readoutRef}
        className="grid gap-1 text-base sm:text-sm tabular-nums sm:grid-cols-2"
      >
        <p>
          Tiempo: <strong data-time>{clock(state.t)}</strong>
        </p>
        <p>
          Se han acercado: <strong data-closed>{closedLabel(state.r)}</strong>
        </p>
        <p>
          Fuerza entre ellos: <strong data-force>{forceLabel(state.r)}</strong>,
          más o menos lo que pesa una pestaña
        </p>
        <p>
          Peso de cada uno en la Tierra: {formatDecimal(PERSON_WEIGHT_N, 0)} N
        </p>
      </div>
      <Choice options={SPEEDS} value={speed} onChange={setSpeed} />
      <p className="text-xs text-slate-600 dark:text-slate-400">
        {SPEED_HINT[speed]}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={BUTTON_PRIMARY}
          disabled={touching}
          onClick={() => {
            settle();
            setRunning(!active);
          }}
        >
          {active ? "Pausa" : "Empezar"}
        </button>
        <button
          type="button"
          className={BUTTON_SECONDARY}
          onClick={() => {
            live.current = INITIAL;
            setRunning(false);
            setState(INITIAL);
          }}
        >
          Volver a separarlos
        </button>
      </div>
      {touching && (
        <p className={EXPERIMENT_TEXT_CLASS}>
          Se tocan al cabo de <strong>{clock(state.t)}</strong>, después de
          recorrer unos {formatDecimal(((START_R - CONTACT_R) / 2) * 100, 0)} cm
          cada uno.
        </p>
      )}
    </Experiment>
  );
}
