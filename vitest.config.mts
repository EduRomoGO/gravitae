import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The React Compiler, as in next.config.ts: the client components carry no
// manual memoization, so the tests must render them memoized as the app does.
// Only files marked "use client": the tests call the async server pages as
// plain functions, outside a render, where the compiled code has no cache.
const clientCompiler = reactCompilerPreset();
clientCompiler.rolldown.filter = { code: /^["']use client["']/ };

export default defineConfig({
  plugins: [react(), babel({ presets: [clientCompiler] })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@tests": fileURLToPath(new URL("./tests", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/support/vitest.setup.ts"],
    // Above the 5 s asyncUtilTimeout set in vitest.setup.ts, so a wait that
    // runs out reports what it was waiting for, not a bare test timeout.
    testTimeout: 15_000,
    include: ["**/*.test.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      "tests/e2e/**",
      "tests/evals/**/*.eval.ts",
      ".next/**",
      ".worktrees/**",
      ".claude/worktrees/**",
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}"],
    },
  },
});
