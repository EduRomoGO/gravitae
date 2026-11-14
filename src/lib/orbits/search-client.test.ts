import { describe, expect, it } from "vitest";
import {
  inlineSearcher,
  workerSearcher,
  type SearchWorker,
} from "./search-client";

/** A Worker that never answers; the test fires its events. */
class SilentWorker extends EventTarget {
  terminated = false;
  postMessage(): void {}
  terminate(): void {
    this.terminated = true;
  }
}

function fakeWorkers() {
  const created: SilentWorker[] = [];
  const create = (): SearchWorker => {
    const worker = new SilentWorker();
    created.push(worker);
    return worker;
  };
  return { created, create };
}

describe("inlineSearcher", () => {
  it("answers a request", async () => {
    const outcome = await inlineSearcher().simulate({ vx: 0, vy: 0 }, 10);
    expect(outcome).toMatchObject({
      kind: "done",
      result: { kind: "collision" },
    });
  });

  it("answers a request superseded by a newer one as superseded", async () => {
    const searcher = inlineSearcher();
    const first = searcher.simulate({ vx: 0, vy: 0 }, 10);
    const second = searcher.simulate({ vx: 0, vy: 0 }, 10);
    expect(await first).toEqual({ kind: "superseded" });
    expect((await second).kind).toBe("done");
  });

  it("answers the running request as superseded when disposed", async () => {
    const searcher = inlineSearcher();
    const running = searcher.close({ vx: 0.3, vy: 0.5 }, 6);
    searcher.dispose();
    expect(await running).toEqual({ kind: "superseded" });
  });
});

describe("workerSearcher", () => {
  it("answers the running request as failed when the worker fails, and starts a new one next", async () => {
    const { created, create } = fakeWorkers();
    const searcher = workerSearcher(create);
    const running = searcher.simulate({ vx: 0.3, vy: 0.5 }, 10);

    created[0]?.dispatchEvent(
      new ErrorEvent("error", { message: "Failed to load the chunk." }),
    );

    expect(await running).toEqual({
      kind: "failed",
      error: "Failed to load the chunk.",
    });
    expect(created[0]?.terminated).toBe(true);
    void searcher.simulate({ vx: 0.3, vy: 0.5 }, 10);
    expect(created).toHaveLength(2);
  });

  it("answers the running request as failed when a message cannot be read", async () => {
    const { created, create } = fakeWorkers();
    const searcher = workerSearcher(create);
    const running = searcher.close({ vx: 0.3, vy: 0.5 }, 6);

    created[0]?.dispatchEvent(new MessageEvent("messageerror"));

    expect(await running).toMatchObject({ kind: "failed" });
  });

  it("answers a request whose calculation failed in the worker as failed", async () => {
    const { created, create } = fakeWorkers();
    const searcher = workerSearcher(create);
    const running = searcher.simulate({ vx: 0.3, vy: 0.5 }, 10);

    created[0]?.dispatchEvent(
      new MessageEvent("message", {
        data: { id: 1, kind: "failed", error: "Unexpected NaN." },
      }),
    );

    expect(await running).toEqual({ kind: "failed", error: "Unexpected NaN." });
  });
});

describe("a closed orbit", () => {
  it("comes back with its lap, ready to play", async () => {
    const outcome = await inlineSearcher().close(
      { vx: 0.3471168881, vy: 0.5327249454 },
      6.3259139829,
    );
    if (outcome.kind !== "done") throw new Error(outcome.kind);

    expect(outcome.result.closure.kind).toBe("closed");
    expect(outcome.result.lap?.period).toBeCloseTo(6.3259139829, 9);
  });
});
