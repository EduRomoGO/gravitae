import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The Gemini key is read in one module, which only server code
// imports: the route handlers of the chats and the correction, for the model,
// the status's route handler, to probe the model, and, to know whether the
// reduced mode applies, the server's reading of the mode, for the pages of
// the lesson and the orbit finder, and the proxy, for every page.
const ROOT = path.resolve(__dirname, "../../..");
const KEY_READER = "src/lib/atomy/gemini.ts";
const KEY_READER_IMPORTERS = [
  "src/app/api/atomy/chat/route.ts",
  "src/app/api/atomy/correction/route.ts",
  "src/app/api/atomy/finder/route.ts",
  "src/app/api/atomy/status/route.ts",
  "src/lib/atomy/server-mode.ts",
  "src/proxy.ts",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const relative = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(relative);
      return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [relative]
        : [];
    },
  );
}

const SOURCES = [
  ...["src/app", "src/components", "src/lib"].flatMap(sourceFiles),
  "src/proxy.ts",
];

describe("the Gemini API key", () => {
  it("is read in a single module", () => {
    const readers = SOURCES.filter((file) =>
      readFileSync(path.join(ROOT, file), "utf8").includes(
        "GOOGLE_GENERATIVE_AI_API_KEY",
      ),
    );

    expect(readers).toEqual([KEY_READER]);
  });

  it("is out of reach of the browser, since only server code imports its reader", () => {
    const importers = SOURCES.filter((file) =>
      readFileSync(path.join(ROOT, file), "utf8").includes(
        "@/lib/atomy/gemini",
      ),
    );

    expect(importers.sort()).toEqual(KEY_READER_IMPORTERS);
    for (const importer of importers) {
      expect(readFileSync(path.join(ROOT, importer), "utf8")).not.toMatch(
        /^["']use client["']/m,
      );
    }
  });

  it("is out of reach of every module through the route handlers, which nothing imports", () => {
    const importers = SOURCES.filter((file) =>
      /api\/atomy\/(chat|correction)\/route/.test(
        readFileSync(path.join(ROOT, file), "utf8"),
      ),
    );

    expect(importers).toEqual([]);
  });
});
