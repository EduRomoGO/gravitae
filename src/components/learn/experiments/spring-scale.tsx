"use client";

// "Dinamómetro entre planetas": an object of 1 kg hangs
// from a spring scale that the reader drags from one planet to another. The
// spring stretches with the weight, mass × g of the planet, in newtons, while
// the label of the object keeps its mass in kilograms. The ruler reaches
// just past Jupiter's weight, so the stretch fills the drawing and the step
// from one planet to another shows clearly. On a narrow
// screen the labels drop their names ("masa:", "peso:", "g =") and keep
// value and unit, so they fit at a readable size.

import { useRef, useState, type ReactElement } from "react";
import { formatDecimal } from "@/lib/format";
import {
  SpringGauge,
  springGaugeLayout,
  svgX,
  useBounce,
} from "@/components/learn/experiments/controls";
import { SURFACE_G } from "@/lib/gravitation/figures";
import { useRegisterWidget } from "@/components/learn/lesson-controller";
import { useWidgetState } from "@/components/learn/lesson/lesson-widget";
import {
  SPRING_SCALE_MASS_KG,
  SPRING_SCALE_PLANETS,
} from "@/lib/lesson/widgets";
import {
  FONT,
  NARROW_ZOOM,
  useTextZoom,
} from "@/components/learn/experiments/text-zoom";
import { Experiment } from "@/components/learn/experiments/experiment";

type SpringScaleAstro = (typeof SPRING_SCALE_PLANETS)[number];

const PLANET_COLORS: Record<
  SpringScaleAstro,
  { color: string; ground: string }
> = {
  Luna: {
    color: "fill-slate-400",
    ground: "fill-slate-300 dark:fill-slate-600",
  },
  Tierra: {
    color: "fill-emerald-600",
    ground: "fill-emerald-300 dark:fill-emerald-800",
  },
  Júpiter: {
    color: "fill-amber-500",
    ground: "fill-amber-200 dark:fill-amber-800",
  },
};

function planetOf(name: SpringScaleAstro) {
  return { name, g: SURFACE_G[name], ...PLANET_COLORS[name] };
}

const PLANETS = SPRING_SCALE_PLANETS.map(planetOf);

const MASS_KG = SPRING_SCALE_MASS_KG;
const MAX_WEIGHT = MASS_KG * Math.max(...PLANETS.map(({ g }) => g));

const WIDTH = 600;
const MIN_HEIGHT = 400;
const SLOT = WIDTH / PLANETS.length;
/** On a narrow screen the text grows a fifth over the zoom that keeps it at its size in pixels. */
const NARROW_TEXT = 1.2;
const RAIL_Y = 24;
/** Smallest side, in CSS pixels, of the area that takes the handle's touch. */
const MIN_TOUCH_PX = 24;
const SPRING_TOP = 40;
/** Jupiter's weight stretches the spring about 200 units of the drawing. */
const GAUGE = { pxPerN: 8, maxN: 30, tickN: 1, labelEvery: 5 } as const;
/** The box's smallest width beside a wide screen's longer labels. */
const BOX_WIDTH = 80;
/** The weight at its widest, which sets the width of the box. */
const WIDEST_WEIGHT = "00,0 N";

/** On a narrow screen only the first tick names the unit. */
const narrowTick = (newtons: number) =>
  newtons > 0 ? String(newtons) : `${String(newtons)} N`;

export function SpringScale(): ReactElement {
  const [saved, update] = useWidgetState("dinamometro", {
    // The Earth, where the scale starts.
    planet: "Tierra",
  });
  const planet = SPRING_SCALE_PLANETS.indexOf(saved.planet);
  const setPlanet = (index: number) => {
    const next = SPRING_SCALE_PLANETS[index];
    if (next !== undefined) update(() => ({ planet: next }));
  };
  /** Position of the scale on the rail while it is dragged; null when it rests on a planet. */
  const [dragX, setDragX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoom = useTextZoom(svgRef, WIDTH);
  const narrow = zoom >= NARROW_ZOOM;
  const textZoom = narrow ? zoom * NARROW_TEXT : zoom;

  // Labels keep their size in pixels: the box grows to hold them, and every
  // slot shifts left so the ruler right of the last planet stays inside.
  const small = FONT.small * textZoom;
  const name = FONT.value * textZoom;
  const boxLines = narrow
    ? [`${String(MASS_KG)} kg`, WIDEST_WEIGHT]
    : [`masa: ${String(MASS_KG)} kg`, `peso: ${WIDEST_WEIGHT}`];
  const gaugeOptions = {
    ...GAUGE,
    zoom: textZoom,
    minBoxWidth: narrow ? 0 : BOX_WIDTH,
    ...(narrow ? { tickText: narrowTick } : {}),
  };
  const gauge = springGaugeLayout({ ...gaugeOptions, label: boxLines });
  const shift = Math.max(12, gauge.right - SLOT / 2 + 4);
  const slotX = (index: number) => SLOT * index + SLOT / 2 - shift;
  const groundY =
    SPRING_TOP + gauge.rest + MAX_WEIGHT * GAUGE.pxPerN + gauge.boxHeight + 16;
  const nameY = groundY + 6 + name;
  const gY = nameY + small * 1.3;
  const height = Math.max(MIN_HEIGHT, gY + small * 0.4 + 12);
  // The handle on the rail grows too, up to the room above the spring.
  const handleHeight = Math.min(20 * zoom, 2 * (SPRING_TOP - RAIL_Y) - 2);
  const handle = {
    width: Math.min(52 * zoom, 100),
    height: handleHeight,
    glyph: Math.min(FONT.small * textZoom, handleHeight * 0.8),
  };
  // The handle is drawn shorter than a finger needs: an invisible area around
  // it takes the touch at the 24 px of WCAG 2.5.8, and goes down into the
  // spring rather than above the drawing.
  const touchSize = MIN_TOUCH_PX * zoom;
  const touch = {
    width: Math.max(handle.width, touchSize),
    height: Math.max(handle.height, touchSize),
  };
  const touchTop = Math.max(0, RAIL_Y - touch.height / 2);

  const current = planetOf(saved.planet);
  const frame = useRegisterWidget("dinamometro", saved, (next) => {
    update(() => next);
  });
  // While dragged in the air between planets, nothing pulls: the spring
  // rests at the weight of the planet the scale left.
  const weight = MASS_KG * current.g;

  /** Displayed weight, animated towards the real one so the spring bounces. */
  const shown = useBounce(weight);

  const x = dragX ?? slotX(planet);

  function pointerX(clientX: number, clientY: number): number | null {
    const svg = svgRef.current;
    return svg ? svgX(svg, clientX, clientY) : null;
  }

  function drop(position: number) {
    const index = Math.round((position - slotX(0)) / SLOT);
    setPlanet(Math.min(PLANETS.length - 1, Math.max(0, index)));
    setDragX(null);
  }

  return (
    <Experiment
      frame={frame}
      instructions={
        <>
          Un objeto de 1 kg cuelga de un dinamómetro (un muelle que mide fuerzas
          en newtons). Pulsa en un planeta para llevar el objeto a ese planeta y
          ver cuánto pesa allí.
        </>
      }
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${String(WIDTH)} ${String(height)}`}
        // Both drags are horizontal: a vertical swipe on the drawing scrolls
        // the page.
        className="w-full touch-pan-y select-none"
        onPointerMove={(e) => {
          if (dragX === null) return;
          const px = pointerX(e.clientX, e.clientY);
          if (px !== null)
            setDragX(
              Math.min(slotX(PLANETS.length - 1), Math.max(slotX(0), px)),
            );
        }}
        onPointerUp={() => {
          if (dragX !== null) drop(dragX);
        }}
        onPointerLeave={() => {
          if (dragX !== null) drop(dragX);
        }}
      >
        <title>{`Dinamómetro colgado sobre ${current.name}`}</title>

        {PLANETS.map((a, i) => (
          <g key={a.name}>
            <g
              role="button"
              tabIndex={0}
              aria-label={`Llevar el dinamómetro a ${a.name}, g = ${formatDecimal(a.g, 2)} m/s²`}
              aria-pressed={i === planet}
              className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-blue-600 [&:focus-visible>rect]:stroke-[3] [&:hover>rect]:opacity-100"
              onClick={() => {
                setPlanet(i);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPlanet(i);
                }
              }}
            >
              <rect
                x={SLOT * i + 4}
                y={groundY}
                width={SLOT - 8}
                height={height - groundY - 4}
                rx={8}
                className={a.ground}
                opacity={i === planet ? 1 : 0.45}
              />
            </g>
            {/* The button's name already says this; drawn on top of the
                button, it lets the pointer through to it. */}
            <g aria-hidden="true" className="pointer-events-none">
              {narrow ? (
                <>
                  <text
                    x={SLOT * i + SLOT / 2}
                    y={nameY}
                    textAnchor="middle"
                    style={{ fontSize: name }}
                    className="fill-current font-semibold"
                  >
                    {a.name}
                  </text>
                  <text
                    x={SLOT * i + SLOT / 2}
                    y={gY}
                    textAnchor="middle"
                    style={{ fontSize: small }}
                    className="fill-current"
                  >
                    {formatDecimal(a.g, 2)} m/s²
                  </text>
                </>
              ) : (
                <>
                  <circle
                    cx={slotX(i) - 34}
                    cy={nameY - name * 0.35}
                    r={9}
                    className={a.color}
                  />
                  <text
                    x={slotX(i) - 20}
                    y={nameY}
                    style={{ fontSize: name }}
                    className="fill-current font-semibold"
                  >
                    {a.name}
                  </text>
                  <text
                    x={slotX(i) - 20}
                    y={gY}
                    style={{ fontSize: small }}
                    className="fill-current"
                  >
                    g = {formatDecimal(a.g, 2)} m/s²
                  </text>
                </>
              )}
            </g>
          </g>
        ))}

        <line
          x1={10}
          y1={RAIL_Y}
          x2={WIDTH - 10}
          y2={RAIL_Y}
          strokeWidth={4}
          className="stroke-slate-500"
        />

        <g
          className={dragX === null ? "cursor-grab" : "cursor-grabbing"}
          onPointerDown={(e) => {
            svgRef.current?.setPointerCapture(e.pointerId);
            const px = pointerX(e.clientX, e.clientY);
            setDragX(px ?? slotX(planet));
          }}
        >
          <rect
            data-part="handle-touch"
            x={x - touch.width / 2}
            y={touchTop}
            width={touch.width}
            height={touch.height}
            fill="transparent"
          />
          <rect
            x={x - handle.width / 2}
            y={RAIL_Y - handle.height / 2}
            width={handle.width}
            height={handle.height}
            rx={6}
            className="fill-fuchsia-700"
          />
          <text
            x={x}
            y={RAIL_Y + handle.glyph * 0.35}
            textAnchor="middle"
            style={{ fontSize: handle.glyph }}
            className="fill-white font-semibold"
          >
            ⇆
          </text>
          <line
            x1={x}
            y1={RAIL_Y + handle.height / 2}
            x2={x}
            y2={SPRING_TOP}
            strokeWidth={2}
            className="stroke-slate-600"
          />
          <SpringGauge
            x={x}
            top={SPRING_TOP}
            weight={shown}
            {...gaugeOptions}
            label={
              narrow
                ? [`${String(MASS_KG)} kg`, `${formatDecimal(weight)} N`]
                : [
                    `masa: ${String(MASS_KG)} kg`,
                    `peso: ${formatDecimal(weight)} N`,
                  ]
            }
            widestLabel={boxLines}
          />
        </g>
      </svg>
    </Experiment>
  );
}
