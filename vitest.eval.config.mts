// The eval against the real Gemini (npm run eval): outside npm run check and
// the unit suite. It reads the keys of .env.local, which Vitest does not load
// by itself, and runs in Node, one case after another.
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@tests": fileURLToPath(new URL("./tests", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/evals/**/*.eval.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    fileParallelism: false,
    testTimeout: 60 * 60 * 1000,
    hookTimeout: 60 * 1000,
  },
}));
