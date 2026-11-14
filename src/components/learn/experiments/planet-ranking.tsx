"use client";

// "Ordena los planetas": the answer input of the planets' prediction. The
// reader ranks three planets by the weight of 1 kg on their surface, seeing
// only each planet's mass; once all three are ranked, the order is the
// reader's answer. Once checked, the experiment adds the radius and the real
// weight next to the reader's order, and the planets drawn by size: Saturn
// has 95 Earth masses and Uranus 14,5, yet 1 kg weighs about the same as on
// Earth or less, because their surface is far from their centre. The
// question, the verdict and the explanation are the prediction's.
// The order given is part of the lesson's progress.

import { useRef, type ReactElement } from "react";
import { z } from "zod";
import { usePersistentState } from "@/components/shared/progress";
import { usePrediction } from "@/components/learn/lesson/predict";
import { useShowAll } from "@/components/learn/lesson/steps";
import { FONT, useTextZoom } from "@/components/learn/experiments/text-zoom";
import { Experiment } from "@/components/learn/experiments/experiment";
import {
  BY_WEIGHT,
  massTimes,
  PLANET_NAMES,
  PLANETS,
  RIGHT_NAMES,
  type PlanetName,
} from "@/components/learn/experiments/planets";
import { orderKey } from "@/components/learn/lesson/responses";
import { formatDecimal } from "@/lib/format";
import { EARTH_MASS_KG } from "@/lib/gravitation/figures";

const orderSchema = z.array(z.enum(PLANET_NAMES)).max(PLANETS.length);

const EARTH_MASS_EXPONENT = Math.floor(Math.log10(EARTH_MASS_KG));
const EARTH_MASS = (
  <>
    {formatDecimal(EARTH_MASS_KG / 10 ** EARTH_MASS_EXPONENT, 2)} × 10
    <sup>{EARTH_MASS_EXPONENT}</sup> kg
  </>
);
const massLabel = (mass: number) =>
  mass === 1 ? EARTH_MASS : `${massTimes(mass)} veces la masa de la Tierra`;
const massShort = (mass: number) =>
  mass === 1 ? EARTH_MASS : `×${massTimes(mass)}`;

const DRAWING_WIDTH = 560;
const DRAWING_CY = 75;
const PX_PER_EARTH_RADIUS = 4.6;
/** The Earth to scale is a dot; it is drawn bigger, out of proportion. */
const MIN_RADIUS_PX = 10;

/** The three planets by size, from the heaviest kilo to the lightest. */
function ScaleDrawing(): ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoom = useTextZoom(svgRef, DRAWING_WIDTH);
  const name = FONT.label * zoom;
  const radiusPx = (radius: number) =>
    Math.max(MIN_RADIUS_PX, radius * PX_PER_EARTH_RADIUS);
  const largest = Math.max(...PLANETS.map((planet) => radiusPx(planet.radius)));
  const step = DRAWING_WIDTH / PLANETS.length;
  const nameY = DRAWING_CY + largest + name * 1.1;
  const height = nameY + name * 0.35;
  return (
    <svg
      ref={svgRef}
      role="img"
      viewBox={`0 0 ${String(DRAWING_WIDTH)} ${String(height)}`}
      className="w-full"
    >
      <title>Los tres planetas dibujados a escala</title>
      {BY_WEIGHT.map((planet, i) => {
        const r = radiusPx(planet.radius);
        const x = step * (i + 0.5);
        return (
          <g key={planet.name}>
            <circle cx={x} cy={DRAWING_CY} r={r} className={planet.color} />
            <text
              x={x}
              y={nameY}
              textAnchor="middle"
              style={{ fontSize: name }}
              className="fill-current"
            >
              {planet.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function PlanetRanking(): ReactElement {
  const { revealed, locked, choose } = usePrediction();
  const showAll = useShowAll();
  const [order, update] = usePersistentState(
    "ordena-los-planetas",
    showAll ? [...RIGHT_NAMES] : [],
    orderSchema,
  );

  function tap(name: PlanetName) {
    const next = order.includes(name)
      ? order.filter((n) => n !== name)
      : [...order, name];
    update(() => next);
    choose(next.length === PLANETS.length ? orderKey(next) : null);
  }

  return (
    <Experiment
      instructions={
        <>
          A continuación se muestran tres planetas junto con su masa. Púlsalos
          en orden, empezando por el planeta donde una masa de 1 kg tendría
          mayor peso y terminando por donde tendría menor peso.
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {PLANETS.map((planet) => {
          const position = order.indexOf(planet.name);
          return (
            <button
              key={planet.name}
              type="button"
              disabled={locked}
              aria-pressed={position >= 0}
              onClick={() => {
                tap(planet.name);
              }}
              className={`rounded-lg border text-center p-2 text-base sm:p-3 ${
                position >= 0
                  ? "border-fuchsia-700 bg-fuchsia-50 dark:bg-fuchsia-950/40"
                  : "border-slate-300 dark:border-slate-700"
              }`}
            >
              <span
                aria-hidden={position < 0}
                className="block text-2xl font-bold tabular-nums text-fuchsia-700 dark:text-fuchsia-300"
              >
                {position >= 0 ? position + 1 : "\u00a0"}
              </span>
              <span className="block font-semibold">{planet.name}</span>
              <span className="block">{massLabel(planet.mass)}</span>
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="space-y-3">
          <ScaleDrawing />
          <table className="w-full border-collapse text-left text-base sm:text-sm">
            <thead>
              <tr>
                {[
                  "Orden real",
                  "Masa",
                  "Radio",
                  "Peso de 1 kg",
                  "Tú dijiste",
                ].map((h) => (
                  <th
                    key={h}
                    className="border-b border-slate-300 py-1 pr-2 font-semibold dark:border-slate-700"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BY_WEIGHT.map((planet, i) => {
                const guessed = order.indexOf(planet.name) + 1;
                return (
                  <tr key={planet.name}>
                    <td className="py-1 pr-2">
                      {i + 1}.º {planet.name}
                    </td>
                    <td className="py-1 pr-2">{massShort(planet.mass)}</td>
                    <td className="py-1 pr-2">
                      ×{formatDecimal(planet.radius, 1)}
                    </td>
                    <td className="py-1 pr-2 font-semibold">
                      {formatDecimal(planet.g, 1)} N
                    </td>
                    <td
                      className={`py-1 pr-2 ${guessed === i + 1 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
                    >
                      {guessed}.º
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Experiment>
  );
}
