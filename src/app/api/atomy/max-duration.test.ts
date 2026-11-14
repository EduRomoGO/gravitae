import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CORRECTION_MAX_ATTEMPTS,
  CORRECTION_TIMEOUT_MS,
} from "@/lib/atomy/correction-handler";
import { CHAT_TIMEOUT } from "@/lib/atomy/surface-chat-handler";

/**
 * The route's maxDuration, in seconds. Next reads it from the source without
 * running it, so it has to be a number literal (route segment config).
 */
function maxDurationOf(route: string): number | undefined {
  const source = readFileSync(path.join(__dirname, route, "route.ts"), "utf8");
  const literal = /^export const maxDuration = (\d+);$/m.exec(source)?.[1];
  return literal === undefined ? undefined : Number(literal);
}

describe("the maxDuration of the routes that call the model", () => {
  it.each(["chat", "finder"])(
    "lets the %s's turn reach its own timeout, with margin",
    (route) => {
      const seconds = maxDurationOf(route);
      expect(seconds).toBeDefined();
      expect((seconds ?? 0) * 1000).toBeGreaterThan(CHAT_TIMEOUT.totalMs);
    },
  );

  it("lets the correction run every attempt to its timeout, with margin", () => {
    const seconds = maxDurationOf("correction");
    expect(seconds).toBeDefined();
    expect((seconds ?? 0) * 1000).toBeGreaterThan(
      CORRECTION_MAX_ATTEMPTS * CORRECTION_TIMEOUT_MS,
    );
  });
});
