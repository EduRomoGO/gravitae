import { describe, expect, it } from "vitest";
import { simulateSeed } from "@/lib/orbits/search";
import {
  FINDER_TOOLS,
  finderActionLine,
  setSeedInput,
  summarizeClosure,
  summarizeSimulation,
} from "@/lib/atomy/finder-tools";

describe("the finder's tools", () => {
  it("accept a seed within the limits only", () => {
    expect(setSeedInput.safeParse({ vx: 0.3, vy: 0.5 }).success).toBe(true);
    expect(setSeedInput.safeParse({ vx: 1.5, vy: 0.5 }).success).toBe(false);
    expect(
      setSeedInput.safeParse({ vx: 0.3, vy: 0.5, maxTime: 100 }).success,
    ).toBe(false);
  });

  it("summarize a simulation without its trajectory", () => {
    expect(
      summarizeSimulation(
        { vx: 0.3, vy: 0.5 },
        30,
        simulateSeed({ vx: 0, vy: 0 }, 30),
      ),
    ).toEqual({
      seed: { vx: 0.3, vy: 0.5 },
      maxTime: 30,
      outcome: "collision",
      bestReturn: null,
    });
  });

  it("summarize a closure with the catalogue orbit it matches", () => {
    expect(
      summarizeClosure({
        kind: "closed",
        seed: { vx: 0.34, vy: 0.53 },
        period: 6.3,
        error: 1e-8,
        iterations: 4,
        knownMatch: { slug: "figura-de-ocho", laps: 2 },
      }),
    ).toMatchObject({
      outcome: "closed",
      knownMatch: { orbit: "figura-de-ocho", laps: 2 },
    });
  });

  it("write a line for each change, from its output", () => {
    expect(
      finderActionLine({
        type: "tool-close_orbit",
        state: "output-available",
        output: {
          outcome: "closed",
          seed: { vx: 0.34, vy: 0.53 },
          period: 12.65,
          error: 1e-8,
          iterations: 4,
          knownMatch: { orbit: "figura-de-ocho", laps: 2 },
        },
      }),
    ).toBe(
      "Atomy cerró la órbita, con periodo 12,65: son 2 vueltas de Figura de ocho.",
    );
    expect(
      finderActionLine({
        type: "tool-set_seed",
        state: "output-available",
        output: {
          seed: { vx: 0.3, vy: -0.5 },
          maxTime: 30,
          outcome: "open",
          bestReturn: null,
        },
      }),
    ).toBe("Atomy probó la semilla vx = 0,3, vy = −0,5.");
    expect(
      finderActionLine({ type: "tool-set_seed", state: "output-error" }),
    ).toBeUndefined();
  });

  it("run through the finder's page", async () => {
    const calls: unknown[] = [];
    const page = {
      setSeed: (seed: unknown, maxTime?: number) => {
        calls.push(["setSeed", seed, maxTime]);
        return Promise.resolve({ ok: false as const, error: "no" });
      },
      startFrom: (slug: unknown) => {
        calls.push(["startFrom", slug]);
        return Promise.resolve({ ok: false as const, error: "no" });
      },
      close: () => {
        calls.push(["close"]);
        return Promise.resolve({ ok: false as const, error: "no" });
      },
    };
    await FINDER_TOOLS.set_seed.run(page, { vx: 0.1, vy: 0.2, maxTime: 20 });
    await FINDER_TOOLS.start_from.run(page, { orbit: "goggles" });
    await FINDER_TOOLS.close_orbit.run(page, {});
    expect(calls).toEqual([
      ["setSeed", { vx: 0.1, vy: 0.2 }, 20],
      ["startFrom", "goggles"],
      ["close"],
    ]);
  });
});
