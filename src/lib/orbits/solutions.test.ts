import { describe, expect, it } from "vitest";
import { adjacentSolutions, isSolutionSlug } from "@/lib/orbits/solutions";

describe("adjacentSolutions", () => {
  it.each([
    ["lagrange", "yin-yang-i", "figura-de-ocho"],
    ["goggles", "butterfly-i", "moth-i"],
    ["yin-yang-i", "moth-i", "lagrange"],
  ] as const)(
    "puts %s between %s and %s, wrapping at the ends",
    (slug, previous, next) => {
      const adjacent = adjacentSolutions(slug);

      expect(adjacent.previous.slug).toBe(previous);
      expect(adjacent.next.slug).toBe(next);
    },
  );
});

describe("isSolutionSlug", () => {
  it.each(["lagrange", "figura-de-ocho", "yin-yang-i"])(
    "accepts the catalogue slug %s",
    (value) => {
      expect(isSolutionSlug(value)).toBe(true);
    },
  );

  it.each(["", "Lagrange", "yin-yang", "toString", "constructor"])(
    "rejects %j, which is not in the catalogue",
    (value) => {
      expect(isSolutionSlug(value)).toBe(false);
    },
  );
});
