import type { BODY_INDICES, BodyIndex } from "@/lib/orbits/solutions";

/**
 * The colour of each of the three bodies, by `BodyIndex`. The values are the
 * `--body-*` custom properties declared in `app/globals.css`, which switch
 * with the colour scheme.
 */
export const BODY_COLORS = [
  "var(--body-1)",
  "var(--body-2)",
  "var(--body-3)",
] as const satisfies Readonly<Record<BodyIndex, string>> & {
  readonly length: (typeof BODY_INDICES)["length"];
};
