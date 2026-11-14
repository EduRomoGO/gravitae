// The only reader of the Gemini key. Server code only: the
// chat's route handler builds the model with it, and the lesson's page asks
// whether it is configured, to offer the reduced mode without it. The key
// itself never leaves this module. The correction's route handler builds
// the model with it too, and the status's route handler probes the model
// with it, to tell whether the model can be reached.
// ATOMY_GEMINI_BASE_URL, optional, points the provider at the fake Gemini
// server the Playwright tests start.

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { ATOMY_MODEL_ID, ATOMY_MODEL_IDS } from "@/lib/atomy/model";
import { fallbackModel } from "@/lib/atomy/model-fallback";
import {
  PROBE_TIMEOUT_MS,
  statusOfProbe,
  type ModelStatus,
} from "@/lib/atomy/model-status";

/** The Gemini API, the AI SDK's own default. */
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function apiKey(): string | undefined {
  // An empty value counts as missing: it is how a test server goes without
  // the key that .env.local would give it.
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY || undefined;
}

/**
 * Where the chat and the probe call Gemini. An empty value counts as
 * missing, as the key's does. The model is given it too, so the two never
 * depend on the AI SDK's own default.
 */
function baseUrl(): string {
  return process.env.ATOMY_GEMINI_BASE_URL || DEFAULT_BASE_URL;
}

/** Whether the server can talk to the language model. */
export function languageModelConfigured(): boolean {
  return apiKey() !== undefined;
}

/**
 * Gemini, the main model followed by the ones that answer when it runs out
 * of quota, or null without a key: the reduced mode.
 */
export function geminiModel(): LanguageModel | null {
  const key = apiKey();
  if (!key) return null;
  const google = createGoogleGenerativeAI({ apiKey: key, baseURL: baseUrl() });
  return fallbackModel(
    google(ATOMY_MODEL_ID),
    ATOMY_MODEL_IDS.slice(1).map((id) => google(id)),
  );
}

/**
 * Asks Gemini for the main model's own resource, which generates nothing: it
 * tells whether the key's server can reach the model. A 429 counts as
 * available, so the main model alone tells it for the whole chain.
 */
export async function probeGemini(
  fetchImpl: typeof fetch = fetch,
): Promise<ModelStatus> {
  const key = apiKey();
  if (!key) return "no-key";
  try {
    const response = await fetchImpl(`${baseUrl()}/models/${ATOMY_MODEL_ID}`, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
    return statusOfProbe(response);
  } catch {
    return statusOfProbe(null);
  }
}
