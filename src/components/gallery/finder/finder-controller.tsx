"use client";

// The state of the orbit finder and the only way to change it: the reader's
// controls and Atomy's tools call the same actions. A seed is simulated as
// soon as it is set; closing works from the simulation's best return. Each
// action resolves with what it left on the page, which Atomy's tools report.
// A closed orbit is written to the URL (?vx=&vy=&t=), so it can be shared; a
// URL with those parameters closes that orbit again on load.

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Lap } from "@/lib/orbits/lap";
import {
  DEFAULT_MAX_TIME,
  MAX_TIME_LIMITS,
  PERIOD_LIMITS,
  SEED_LIMITS,
  seedOf,
  type Closure,
  type Seed,
  type Simulation,
} from "@/lib/orbits/search";
import type { Searcher } from "@/lib/orbits/search-client";
import type { SolutionSlug } from "@/lib/orbits/solutions";

export type SimulationState =
  | { readonly status: "running" }
  | { readonly status: "done"; readonly result: Simulation }
  /** The calculation failed; changing the seed simulates it again. */
  | { readonly status: "failed"; readonly error: string };

type ClosedClosure = Extract<Closure, { kind: "closed" }>;

export type ClosureState =
  | { readonly status: "idle" }
  | { readonly status: "running" }
  /** The calculation failed; closing can be asked for again. */
  | { readonly status: "failed"; readonly error: string }
  | {
      readonly status: "closed";
      readonly result: ClosedClosure;
      /** The lap to play. */
      readonly lap: Lap;
    }
  /** The closure finished, but the orbit did not close. */
  | {
      readonly status: "not-closed";
      readonly result: Exclude<Closure, ClosedClosure>;
    };

export interface FinderState {
  readonly seed: Seed;
  readonly maxTime: number;
  readonly simulation: SimulationState;
  readonly closure: ClosureState;
}

/** What an action left on the page, or why it could not run. */
export type ActionResult<Output> =
  | { readonly ok: true; readonly output: Output }
  | { readonly ok: false; readonly error: string };

export interface FinderController {
  readonly state: FinderState;
  /** Reads the state as it is now, also from a callback of an older render. */
  readonly current: () => FinderState;
  /** Sets the seed and, if given, the simulated time, and simulates it. */
  readonly setSeed: (
    seed: Seed,
    maxTime?: number,
  ) => Promise<ActionResult<Simulation>>;
  /** Sets the simulated time and simulates the current seed again. */
  readonly setMaxTime: (maxTime: number) => Promise<ActionResult<Simulation>>;
  /** Starts from the seed of a catalogue orbit. */
  readonly startFrom: (slug: SolutionSlug) => Promise<ActionResult<Simulation>>;
  /** Corrects the seed from its best return until the orbit closes. */
  readonly close: () => Promise<ActionResult<Closure>>;
}

/** The seed shown first: the figure of eight, nudged so it is not closed yet. */
export const INITIAL_SEED: Seed = { vx: 0.36, vy: 0.52 };

const SEARCH_PARAMS = { vx: "vx", vy: "vy", period: "t" } as const;

function within(value: number, { min, max }: { min: number; max: number }) {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** Why a seed or a simulated time cannot be used, or null when they can. */
export function invalidInput(seed: Seed, maxTime: number): string | null {
  if (!within(seed.vx, SEED_LIMITS) || !within(seed.vy, SEED_LIMITS))
    return `vx and vy must be between ${String(SEED_LIMITS.min)} and ${String(SEED_LIMITS.max)}.`;
  if (!within(maxTime, MAX_TIME_LIMITS))
    return `maxTime must be between ${String(MAX_TIME_LIMITS.min)} and ${String(MAX_TIME_LIMITS.max)}.`;
  return null;
}

/** The closed orbit a URL shares, if it shares a valid one. */
export function sharedOrbit(
  search: string,
): { seed: Seed; period: number } | null {
  const params = new URLSearchParams(search);
  const read = (name: string) => {
    const raw = params.get(name);
    return raw === null || raw.trim() === "" ? NaN : Number(raw);
  };
  const seed = { vx: read(SEARCH_PARAMS.vx), vy: read(SEARCH_PARAMS.vy) };
  const period = read(SEARCH_PARAMS.period);
  if (invalidInput(seed, DEFAULT_MAX_TIME) !== null) return null;
  if (!within(period, PERIOD_LIMITS)) return null;
  return { seed, period };
}

/** The URL of the page with a closed orbit, or without any. */
export function orbitUrl(
  location: { pathname: string },
  orbit: { seed: Seed; period: number } | null,
): string {
  if (!orbit) return location.pathname;
  const params = new URLSearchParams({
    [SEARCH_PARAMS.vx]: String(orbit.seed.vx),
    [SEARCH_PARAMS.vy]: String(orbit.seed.vy),
    [SEARCH_PARAMS.period]: String(orbit.period),
  });
  return `${location.pathname}?${params.toString()}`;
}

/** The state a finished closure leaves; the search sends a closed orbit with its lap. */
function closureStateOf(result: Closure, lap: Lap | null): ClosureState {
  if (result.kind !== "closed") return { status: "not-closed", result };
  if (lap === null)
    throw new Error("The search sent a closed orbit without its lap.");
  return { status: "closed", result, lap };
}

const FinderContext = createContext<FinderController | null>(null);

export function useFinder(): FinderController {
  const controller = useContext(FinderContext);
  if (!controller) throw new Error("useFinder needs a FinderProvider.");
  return controller;
}

/** The finder, or null outside it: the chat reads it only on the finder. */
export function useOptionalFinder(): FinderController | null {
  return useContext(FinderContext);
}

export function FinderProvider({
  searcher,
  children,
}: {
  /** Created by the caller, so the tests can calculate without a Worker. */
  searcher: () => Searcher;
  children: ReactNode;
}): ReactElement {
  const [search] = useState(searcher);
  const [state, setState] = useState<FinderState>({
    seed: INITIAL_SEED,
    maxTime: DEFAULT_MAX_TIME,
    simulation: { status: "running" },
    closure: { status: "idle" },
  });
  // The actions read and write the state through this ref, so a chain of
  // them in one tick, as Atomy's tools make, sees each other's changes.
  const stateRef = useRef(state);
  const update = (next: (previous: FinderState) => FinderState) => {
    stateRef.current = next(stateRef.current);
    setState(stateRef.current);
  };

  function writeUrl(orbit: { seed: Seed; period: number } | null) {
    window.history.replaceState(null, "", orbitUrl(window.location, orbit));
  }

  async function simulate(): Promise<ActionResult<Simulation>> {
    const { seed, maxTime } = stateRef.current;
    update((previous) => ({
      ...previous,
      simulation: { status: "running" },
      closure: { status: "idle" },
    }));
    writeUrl(null);
    const outcome = await search.simulate(seed, maxTime);
    if (outcome.kind === "superseded")
      return { ok: false, error: "A newer change replaced this simulation." };
    if (outcome.kind === "failed") {
      update((previous) => ({
        ...previous,
        simulation: { status: "failed", error: outcome.error },
      }));
      return {
        ok: false,
        error: `The simulation failed: ${outcome.error}`,
      };
    }
    update((previous) => ({
      ...previous,
      simulation: { status: "done", result: outcome.result },
    }));
    return { ok: true, output: outcome.result };
  }

  async function closeFrom(
    seed: Seed,
    period: number,
  ): Promise<ActionResult<Closure>> {
    update((previous) => ({ ...previous, closure: { status: "running" } }));
    const outcome = await search.close(seed, period);
    if (outcome.kind === "superseded")
      return { ok: false, error: "A newer change replaced this closure." };
    if (outcome.kind === "failed") {
      update((previous) => ({
        ...previous,
        closure: { status: "failed", error: outcome.error },
      }));
      return { ok: false, error: `The closure failed: ${outcome.error}` };
    }
    // The lap comes integrated from the search, off the main thread.
    const { closure: result, lap } = outcome.result;
    update((previous) => ({
      ...previous,
      ...(result.kind === "closed" ? { seed: result.seed } : {}),
      closure: closureStateOf(result, lap),
    }));
    writeUrl(
      result.kind === "closed"
        ? { seed: result.seed, period: result.period }
        : null,
    );
    return { ok: true, output: result };
  }

  const setSeed: FinderController["setSeed"] = (seed, maxTime) => {
    const time = maxTime ?? stateRef.current.maxTime;
    const invalid = invalidInput(seed, time);
    if (invalid !== null) return Promise.resolve({ ok: false, error: invalid });
    update((previous) => ({ ...previous, seed, maxTime: time }));
    return simulate();
  };

  const controller: FinderController = {
    state,
    current: () => stateRef.current,
    setSeed,
    setMaxTime: (maxTime) => setSeed(stateRef.current.seed, maxTime),
    startFrom: (slug) => {
      const seed = seedOf(slug);
      return seed === null
        ? Promise.resolve({
            ok: false,
            error: `"${slug}" does not start in line, so it has no seed in this scheme.`,
          })
        : setSeed(seed);
    },
    close: () => {
      const { seed, simulation } = stateRef.current;
      if (simulation.status === "running")
        return Promise.resolve({
          ok: false,
          error: "The seed is still being simulated.",
        });
      if (simulation.status === "failed")
        return Promise.resolve({
          ok: false,
          error: "The seed's simulation failed: there is no return to close.",
        });
      if (simulation.result.kind === "collision")
        return Promise.resolve({
          ok: false,
          error:
            "Two bodies collide with this seed: there is no return to close.",
        });
      if (simulation.result.bestReturn === null)
        return Promise.resolve({
          ok: false,
          error:
            "The bodies never come back towards the start within the simulated time.",
        });
      return closeFrom(seed, simulation.result.bestReturn.time);
    },
  };

  // On load: the orbit the URL shares, closed again, or the first seed.
  const load = useEffectEvent(() => {
    const shared = sharedOrbit(window.location.search);
    if (!shared) {
      void simulate();
      return;
    }
    update((previous) => ({ ...previous, seed: shared.seed }));
    // Only if the reader has not changed the seed meanwhile: closing would
    // replace their simulation in the worker.
    void simulate().then((simulated) =>
      simulated.ok ? closeFrom(shared.seed, shared.period) : simulated,
    );
  });
  useEffect(() => {
    load();
  }, []);

  useEffect(
    () => () => {
      search.dispose();
    },
    [search],
  );

  return (
    <FinderContext.Provider value={controller}>
      {children}
    </FinderContext.Provider>
  );
}
