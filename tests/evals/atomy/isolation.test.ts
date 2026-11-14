// No module of the app imports the OpenCode Go provider: only the eval does.
// The app talks to Gemini alone, with no interchangeable providers.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const APP_DIRS = ["src/app", "src/components", "src/lib"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mts|js|mjs)$/.test(entry.name) ? [path] : [];
  });
}

describe("the app's modules", () => {
  it("never import the OpenCode Go provider", () => {
    const importers = APP_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)))
      .filter((file) =>
        readFileSync(file, "utf8").includes("@ai-sdk/openai-compatible"),
      )
      .map((file) => file.slice(ROOT.length + 1));

    expect(importers).toEqual([]);
  });

  it("are searched for the import the eval's own provider module has", () => {
    expect(
      readFileSync(join(ROOT, "tests/evals/atomy/providers.ts"), "utf8"),
    ).toContain("@ai-sdk/openai-compatible");
  });
});
