// The orbit finder as the chat with Atomy reaches it
// (components/atomy/chat-surface.ts): its seed, its simulation and its
// closure, and the finder's tools run through its controller.

import type { ChatSurface } from "@/components/atomy/chat-surface";
import type {
  FinderController,
  FinderState,
} from "@/components/gallery/finder/finder-controller";
import type { FinderSnapshot } from "@/lib/atomy/finder-chat-request";
import {
  FINDER_TOOLS,
  summarizeClosure,
  summarizeSimulation,
  type FinderPage,
} from "@/lib/atomy/finder-tools";
import { notOnThisPage } from "@/lib/atomy/surface-tools";

export const FINDER_CHAT_API = "/api/atomy/finder";

const LESSON_TOOLS_ELSEWHERE = {
  go_to_section: () => notOnThisPage("go_to_section"),
  set_widget: () => notOnThisPage("set_widget"),
} as const;

/** The finder's state, as the snapshot carries it. */
export function finderSnapshotOf({
  seed,
  maxTime,
  simulation,
  closure,
}: FinderState): FinderSnapshot {
  return {
    seed: { vx: seed.vx, vy: seed.vy },
    maxTime,
    simulation:
      simulation.status === "done"
        ? {
            status: "done",
            summary: summarizeSimulation(seed, maxTime, simulation.result),
          }
        : { status: simulation.status },
    closure:
      closure.status === "closed" || closure.status === "not-closed"
        ? { status: "done", summary: summarizeClosure(closure.result) }
        : { status: closure.status },
  };
}

/** The finder's controller as the tools reach it. */
export function finderPageOf(finder: FinderController): FinderPage {
  const simulated = async (
    action: ReturnType<FinderController["setSeed"]>,
  ): ReturnType<FinderPage["setSeed"]> => {
    const result = await action;
    if (!result.ok) return result;
    const { seed, maxTime } = finder.current();
    return {
      ok: true,
      output: summarizeSimulation(seed, maxTime, result.output),
    };
  };
  return {
    setSeed: (seed, maxTime) => simulated(finder.setSeed(seed, maxTime)),
    startFrom: (slug) => simulated(finder.startFrom(slug)),
    close: async () => {
      const result = await finder.close();
      return result.ok
        ? { ok: true, output: summarizeClosure(result.output) }
        : result;
    },
  };
}

/** The orbit finder: its seed, its simulation and its closure. */
export function finderSurface(finder: FinderController | null): ChatSurface {
  const page = finder ? finderPageOf(finder) : null;
  const noFinder = () =>
    Promise.resolve({
      ok: false as const,
      error: "The finder is not on the page.",
    });
  return {
    api: FINDER_CHAT_API,
    snapshot: () =>
      finder ? { snapshot: finderSnapshotOf(finder.current()) } : null,
    tools: {
      set_seed: (input) =>
        page ? FINDER_TOOLS.set_seed.run(page, input) : noFinder(),
      start_from: (input) =>
        page ? FINDER_TOOLS.start_from.run(page, input) : noFinder(),
      close_orbit: (input) =>
        page ? FINDER_TOOLS.close_orbit.run(page, input) : noFinder(),
      ...LESSON_TOOLS_ELSEWHERE,
    },
  };
}
