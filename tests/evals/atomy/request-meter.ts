// Counts the requests the eval sends to a provider, spaces
// them to stay under a per-minute limit, and stops the provider at its first
// 429: after it, no request reaches the network, so the AI SDK's own retries
// spend nothing more and the eval ends with what it has.

export class RateLimitedError extends Error {
  constructor() {
    super("The provider answered 429: the eval stops sending it requests.");
    this.name = "RateLimitedError";
  }
}

export interface RequestMeter {
  /** The fetch the provider is built with. */
  fetch: typeof globalThis.fetch;
  /** The requests that reached the network. */
  readonly requests: number;
  /** Whether the provider answered 429. */
  readonly rateLimited: boolean;
}

export function requestMeter({
  fetch,
  minIntervalMs = 0,
  now = () => performance.now(),
  sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    }),
}: {
  fetch: typeof globalThis.fetch;
  minIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): RequestMeter {
  let requests = 0;
  let rateLimited = false;
  let last: number | undefined;
  return {
    get requests() {
      return requests;
    },
    get rateLimited() {
      return rateLimited;
    },
    fetch: async (input, init) => {
      if (rateLimited) throw new RateLimitedError();
      if (last !== undefined) {
        const wait = minIntervalMs - (now() - last);
        if (wait > 0) await sleep(wait);
      }
      last = now();
      requests += 1;
      const response = await fetch(input, init);
      if (response.status === 429) rateLimited = true;
      return response;
    },
  };
}
