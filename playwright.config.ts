import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import {
  APP_PORT,
  FAKE_GEMINI_ORIGIN,
  FAKE_GEMINI_PORT,
  REDUCED_APP_ORIGIN,
  REDUCED_APP_PORT,
} from "./tests/e2e/ports";

const port = APP_PORT;
const origin = `http://localhost:${String(port)}`;

// Even with a temporary profile, Firefox looks up its app-data directory in
// ~/Library/Application Support/Firefox. macOS 27 denies that directory to
// processes launched from a terminal, and Firefox exits with "Could not find
// profile folder".
const firefoxMacOsOptions =
  process.platform === "darwin"
    ? {
        launchOptions: {
          // `env` replaces the browser's environment instead of extending it.
          env: {
            ...process.env,
            MOZ_APP_DATA: path.join(os.tmpdir(), "gravitae-firefox-app-data"),
          },
        },
      }
    : {};

// The local `npm run check` runs e2e at low priority (scripts/ci.sh), so a
// test can wait for CPU behind the user's work.
const slowdown = process.env.CHECK_THROTTLED ? 2 : 1;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000 * slowdown,
  expect: { timeout: 5_000 * slowdown },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: origin,
    trace: "on-first-retry",
  },
  // Chromium runs every test; Firefox and WebKit only the ones tagged
  // @cross-browser (see tests/e2e/tags.ts). There are no mobile projects: the
  // responsive tests set their own viewport and no test uses touch.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox",
      grep: /@cross-browser/,
      use: { ...devices["Desktop Firefox"], ...firefoxMacOsOptions },
    },
    {
      name: "webkit",
      grep: /@cross-browser/,
      use: { ...devices["Desktop Safari"] },
    },
  ],
  // Tests run against the production build, as the Next.js testing guide
  // recommends, with the chat pointed at the fake Gemini: the fake key makes
  // the route handler call it instead of answering with the reduced mode.
  // A second server, started after the build, serves the same build without
  // the key, for the reduced-mode tests (tests/e2e/atomy-reduced-mode.spec.ts).
  webServer: [
    {
      command: `node tests/e2e/fake-gemini.mts ${String(FAKE_GEMINI_PORT)}`,
      url: FAKE_GEMINI_ORIGIN,
      reuseExistingServer: false,
    },
    {
      command: `npm run build && npm run start -- --port ${String(port)}`,
      url: origin,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        // A NODE_ENV=development inherited from the shell makes `next build` fail.
        NODE_ENV: "production",
        // Set here, they take precedence over .env.local.
        GOOGLE_GENERATIVE_AI_API_KEY: "fake-key",
        ATOMY_GEMINI_BASE_URL: `${FAKE_GEMINI_ORIGIN}/v1beta`,
      },
    },
    {
      command: `npm run start -- --port ${String(REDUCED_APP_PORT)}`,
      url: REDUCED_APP_ORIGIN,
      reuseExistingServer: false,
      env: {
        NODE_ENV: "production",
        // Empty, so .env.local cannot fill it in: the app counts it as missing.
        GOOGLE_GENERATIVE_AI_API_KEY: "",
      },
    },
  ],
});
