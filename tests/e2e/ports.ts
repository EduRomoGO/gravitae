import { createHash } from "node:crypto";
import path from "node:path";

// The ports of the servers the tests run against, shared by the Playwright
// config and the tests that talk to the fake Gemini.

const checkout = path.dirname(path.dirname(__dirname));

// Derived from the checkout's path so parallel git worktrees get different
// ports and each one tests its own build. E2E_PORT overrides it on a collision.
export const APP_PORT = Number(
  process.env.E2E_PORT ??
    3100 +
      (createHash("sha256").update(checkout).digest().readUInt16BE(0) % 900),
);

/** The fake Gemini the chat's route handler talks to (e2e/fake-gemini.mts). */
export const FAKE_GEMINI_PORT = APP_PORT + 1000;
export const FAKE_GEMINI_ORIGIN = `http://localhost:${String(FAKE_GEMINI_PORT)}`;

/** The same build served without the Gemini key: the reduced mode. */
export const REDUCED_APP_PORT = APP_PORT + 2000;
export const REDUCED_APP_ORIGIN = `http://localhost:${String(REDUCED_APP_PORT)}`;
