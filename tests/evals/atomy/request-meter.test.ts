import { describe, expect, it } from "vitest";
import {
  RateLimitedError,
  requestMeter,
} from "@tests/evals/atomy/request-meter";

function fakeNetwork(statuses: number[]) {
  const calls: string[] = [];
  const fetch: typeof globalThis.fetch = (input) => {
    calls.push(input instanceof Request ? input.url : input.toString());
    return Promise.resolve(
      new Response(null, { status: statuses.shift() ?? 200 }),
    );
  };
  return { calls, fetch };
}

function fakeClock() {
  let time = 0;
  const waits: number[] = [];
  return {
    waits,
    now: () => time,
    sleep: (ms: number) => {
      waits.push(ms);
      time += ms;
      return Promise.resolve();
    },
  };
}

describe("the meter of a provider's requests", () => {
  it("counts every request that reaches the network", async () => {
    const network = fakeNetwork([200, 500]);
    const meter = requestMeter({ fetch: network.fetch });

    await meter.fetch("https://provider/a");
    await meter.fetch("https://provider/b");

    expect(meter.requests).toBe(2);
    expect(network.calls).toHaveLength(2);
  });

  it("spaces the requests at least the interval apart", async () => {
    const network = fakeNetwork([]);
    const clock = fakeClock();
    const meter = requestMeter({
      fetch: network.fetch,
      minIntervalMs: 1000,
      ...clock,
    });

    await meter.fetch("https://provider/a");
    await clock.sleep(300);
    await meter.fetch("https://provider/b");

    expect(clock.waits).toEqual([300, 700]);
  });

  it("stops at the first 429: no later request reaches the network", async () => {
    const network = fakeNetwork([429]);
    const meter = requestMeter({ fetch: network.fetch });

    const first = await meter.fetch("https://provider/a");
    await expect(meter.fetch("https://provider/b")).rejects.toBeInstanceOf(
      RateLimitedError,
    );

    expect(first.status).toBe(429);
    expect(meter.rateLimited).toBe(true);
    expect(meter.requests).toBe(1);
    expect(network.calls).toHaveLength(1);
  });
});
