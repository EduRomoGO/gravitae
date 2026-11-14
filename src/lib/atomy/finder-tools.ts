// The tools with which Atomy operates the orbit finder, one entry per tool:
// what the model reads of it (description and schemas), how the page runs it
// and the line the chat writes for its result. As with the lesson's tools
// (client-tools.ts), the finder's state lives in the reader's browser, so no
// entry has an `execute`: the chat runs `run` through the finder's controller
// and sends the result back with the next request. Every call is validated
// against its inputSchema before it reaches the page. They only change the
// page: no network, nothing written outside it.

import { z } from "zod";
import type { PageToolResult } from "@/lib/atomy/chat-messages";
import {
  actionLineOf,
  surfaceTool,
  type SurfaceTool,
} from "@/lib/atomy/surface-tool";
import { formatCoordinate, formatSimulationTime } from "@/lib/format";
import {
  MAX_TIME_LIMITS,
  SEED_LIMITS,
  type Closure,
  type Seed,
  type Simulation,
} from "@/lib/orbits/search";
import { getSolution, type SolutionSlug } from "@/lib/orbits/solutions";

/** The catalogue orbits that start in line, which have a seed. */
export const SEEDED_SLUGS = [
  "figura-de-ocho",
  "butterfly-i",
  "goggles",
  "moth-i",
  "yin-yang-i",
] as const satisfies readonly SolutionSlug[];

const seedComponent = z.number().min(SEED_LIMITS.min).max(SEED_LIMITS.max);
const maxTime = z.number().min(MAX_TIME_LIMITS.min).max(MAX_TIME_LIMITS.max);
const nonNegative = z.number().min(0);

export const seedSchema = z.strictObject({
  vx: seedComponent.describe(
    "Componente x de la velocidad de los cuerpos de los extremos",
  ),
  vy: seedComponent.describe(
    "Componente y de la velocidad de los cuerpos de los extremos",
  ),
});

/** A simulation as the model reads it: the seed, and how close the bodies came back. */
export const simulationSummary = z.strictObject({
  seed: seedSchema,
  maxTime,
  outcome: z.enum(["open", "collision"]),
  /** Null after a collision, or when the bodies never came back closer. */
  bestReturn: z
    .strictObject({ time: nonNegative, distance: nonNegative })
    .nullable(),
});

export type SimulationSummary = z.infer<typeof simulationSummary>;

export const closureSummary = z.discriminatedUnion("outcome", [
  z.strictObject({
    outcome: z.literal("closed"),
    seed: seedSchema,
    period: z.number().positive(),
    error: nonNegative,
    iterations: z.number().int().min(0),
    knownMatch: z
      .strictObject({
        orbit: z.enum(SEEDED_SLUGS),
        laps: z.number().int().min(1),
      })
      .nullable(),
  }),
  z.strictObject({
    outcome: z.literal("not-converged"),
    error: nonNegative,
    iterations: z.number().int().min(0),
  }),
  z.strictObject({ outcome: z.literal("collision") }),
]);

export type ClosureSummary = z.infer<typeof closureSummary>;

export function summarizeSimulation(
  seed: Seed,
  time: number,
  simulation: Simulation,
): SimulationSummary {
  return {
    seed: { vx: seed.vx, vy: seed.vy },
    maxTime: time,
    outcome: simulation.kind,
    bestReturn:
      simulation.kind === "open" && simulation.bestReturn
        ? { ...simulation.bestReturn }
        : null,
  };
}

function isSeededSlug(
  slug: SolutionSlug,
): slug is (typeof SEEDED_SLUGS)[number] {
  return SEEDED_SLUGS.some((seeded) => seeded === slug);
}

export function summarizeClosure(closure: Closure): ClosureSummary {
  switch (closure.kind) {
    case "closed": {
      const match = closure.knownMatch;
      return {
        outcome: "closed",
        seed: { vx: closure.seed.vx, vy: closure.seed.vy },
        period: closure.period,
        error: closure.error,
        iterations: closure.iterations,
        knownMatch:
          match && isSeededSlug(match.slug)
            ? { orbit: match.slug, laps: match.laps }
            : null,
      };
    }
    case "not-converged":
      return {
        outcome: "not-converged",
        error: closure.error,
        iterations: closure.iterations,
      };
    case "collision":
      return { outcome: "collision" };
  }
}

/** The finder as the tools reach it: the controller's actions. */
export interface FinderPage {
  readonly setSeed: (
    seed: Seed,
    maxTime?: number,
  ) => Promise<PageToolResult<SimulationSummary>>;
  readonly startFrom: (
    slug: (typeof SEEDED_SLUGS)[number],
  ) => Promise<PageToolResult<SimulationSummary>>;
  readonly close: () => Promise<PageToolResult<ClosureSummary>>;
}

export const setSeedInput = z.strictObject({
  ...seedSchema.shape,
  maxTime: maxTime
    .describe(
      "Tiempo que se simula, en unidades de tiempo; si falta, se mantiene el actual",
    )
    .exactOptional(),
});

export const startFromInput = z.strictObject({
  orbit: z
    .enum(SEEDED_SLUGS)
    .describe("La órbita de la galería de la que partir"),
});

export const closeOrbitInput = z.strictObject({});

export const FINDER_TOOL_NAMES = [
  "set_seed",
  "start_from",
  "close_orbit",
] as const;

export type FinderToolName = (typeof FINDER_TOOL_NAMES)[number];

/** What each tool of the finder takes and gives, as the chat's messages carry it. */
export type FinderToolTypes = {
  readonly set_seed: {
    readonly input: z.infer<typeof setSeedInput>;
    readonly output: SimulationSummary;
  };
  readonly start_from: {
    readonly input: z.infer<typeof startFromInput>;
    readonly output: SimulationSummary;
  };
  readonly close_orbit: {
    readonly input: z.infer<typeof closeOrbitInput>;
    readonly output: ClosureSummary;
  };
};

function seedText({ vx, vy }: Seed): string {
  return `vx = ${formatCoordinate(vx)}, vy = ${formatCoordinate(vy)}`;
}

type FinderTool<Name extends FinderToolName> = SurfaceTool<
  FinderPage,
  FinderToolTypes[Name]["input"],
  FinderToolTypes[Name]["output"],
  Promise<PageToolResult<FinderToolTypes[Name]["output"]>>
>;

export const FINDER_TOOLS: {
  readonly [Name in FinderToolName]: FinderTool<Name>;
} = {
  set_seed: surfaceTool({
    description:
      "Pone en el buscador una semilla (la velocidad inicial de los cuerpos de los extremos) y la simula, como si el lector moviera sus controles. Devuelve el instante y la distancia del mejor regreso al punto de partida.",
    inputSchema: setSeedInput,
    outputSchema: simulationSummary,
    run: (page: FinderPage, { maxTime: time, ...seed }) =>
      page.setSeed(seed, time),
    actionLine: ({ seed }) => `Atomy probó la semilla ${seedText(seed)}.`,
  }),
  start_from: surfaceTool({
    description:
      "Pone en el buscador la semilla de una órbita de la galería y la simula.",
    inputSchema: startFromInput,
    outputSchema: simulationSummary,
    run: (page: FinderPage, { orbit }) => page.startFrom(orbit),
    actionLine: ({ seed }) => `Atomy partió de la semilla ${seedText(seed)}.`,
  }),
  close_orbit: surfaceTool({
    description:
      "Corrige la semilla y el periodo a partir del mejor regreso de la simulación actual hasta que la órbita se cierra, o hasta que la corrección deja de mejorar. Devuelve el resultado.",
    inputSchema: closeOrbitInput,
    outputSchema: closureSummary,
    run: (page: FinderPage) => page.close(),
    actionLine: (closure) => {
      switch (closure.outcome) {
        case "closed": {
          const match = closure.knownMatch;
          const known = !match
            ? ""
            : match.laps === 1
              ? `: es ${getSolution(match.orbit).name}`
              : `: son ${String(match.laps)} vueltas de ${getSolution(match.orbit).name}`;
          return `Atomy cerró la órbita, con periodo ${formatSimulationTime(closure.period)}${known}.`;
        }
        case "not-converged":
          return "Atomy intentó cerrar la órbita, pero la corrección no la cerró.";
        case "collision":
          return "Atomy intentó cerrar la órbita, pero dos cuerpos chocan.";
      }
    },
  }),
};

/** The type of a tool of the finder's part in a message. */
export type FinderToolPartType = `tool-${FinderToolName}`;

export const FINDER_TOOL_PART_TYPES: readonly FinderToolPartType[] =
  FINDER_TOOL_NAMES.map((name): FinderToolPartType => `tool-${name}`);

/** The line the chat writes for a tool of the finder that changed the page. */
export const finderActionLine = actionLineOf(FINDER_TOOLS, FINDER_TOOL_NAMES);
