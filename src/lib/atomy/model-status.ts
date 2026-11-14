// Whether the language model can answer right now, as the interface needs to
// know it to offer the advanced mode or the reduced one: no key, the key but
// no way to reach the model, or available. The probe asks the model's own
// resource, which generates nothing (lib/atomy/gemini.ts). An available
// answer is kept for a while, so that every page load does not reach the
// provider; an unavailable one is not, so the mode comes back as soon as
// the model does.

export const MODEL_STATUSES = ["available", "no-key", "unreachable"] as const;

export type ModelStatus = (typeof MODEL_STATUSES)[number];

/** How long an available answer is trusted. */
export const AVAILABLE_TTL_MS = 60_000;

/** How long the probe waits for the provider before counting it unreachable. */
export const PROBE_TIMEOUT_MS = 3_000;

/**
 * The status of the model from the provider's answer to the probe: a
 * network failure, a timeout or a 5xx is unreachable; a 429 is available,
 * since the quota's own message already tells the reader.
 */
export function statusOfProbe(
  response: { status: number } | null,
): ModelStatus {
  if (response === null) return "unreachable";
  return response.status >= 500 ? "unreachable" : "available";
}

export function createModelStatusCache(
  probe: () => Promise<ModelStatus>,
  now: () => number = Date.now,
): (options?: { fresh?: boolean }) => Promise<ModelStatus> {
  let availableUntil = -Infinity;
  return async ({ fresh = false } = {}) => {
    if (!fresh && now() < availableUntil) return "available";
    const status = await probe();
    availableUntil =
      status === "available" ? now() + AVAILABLE_TTL_MS : -Infinity;
    return status;
  };
}
