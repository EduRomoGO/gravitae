// The eval's two providers, each behind a request meter: Gemini, the app's
// model, with the production model id; and OpenCode Go, the judge and the
// simulated reader, through @ai-sdk/openai-compatible. Only the eval imports
// this module: the app never uses OpenCode Go (isolation.test.ts checks it).

import { randomUUID } from "node:crypto";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { ATOMY_MODEL_ID } from "@/lib/atomy/model";
import {
  requestMeter,
  type RequestMeter,
} from "@tests/evals/atomy/request-meter";

/**
 * The judge, from the list OpenCode Go serves at /v1/models (2026-11-12):
 * another family than Gemini, served on chat completions, with structured
 * output. Fixed here, so that runs compare with the same judge.
 */
export const JUDGE_MODEL_ID = "glm-5.3";

/** The simulated reader of the multi-turn cases: same family, cheaper. */
export const READER_MODEL_ID = "glm-5.3-flash";

/** OpenCode Go asks clients for their own User-Agent, not the SDK's. */
export const EVAL_USER_AGENT = "gravitae-eval";

/**
 * Gemini's Free tier limits requests per minute; the eval stays under 10 by
 * spacing them. Not a published figure for gemini-3.8-flash: a margin.
 */
export const GEMINI_MIN_INTERVAL_MS = 6500;

export interface EvalEnv {
  geminiKey: string;
  openCodeKey: string;
  openCodeBaseURL: string;
}

/** The keys the eval needs, or the names of those missing. */
export function evalEnv(
  env: Readonly<Record<string, string | undefined>>,
): EvalEnv | { missing: string[] } {
  const geminiKey = env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
  const openCodeKey = env.AI_API_KEY ?? "";
  const openCodeBaseURL = env.AI_BASE_URL ?? "";
  const missing = [
    ...(geminiKey ? [] : ["GOOGLE_GENERATIVE_AI_API_KEY"]),
    ...(openCodeKey ? [] : ["AI_API_KEY"]),
    ...(openCodeBaseURL ? [] : ["AI_BASE_URL"]),
  ];
  return missing.length > 0
    ? { missing }
    : { geminiKey, openCodeKey, openCodeBaseURL };
}

export interface EvalModels {
  gemini: LanguageModel;
  judge: LanguageModel;
  reader: LanguageModel;
  geminiMeter: RequestMeter;
  openCodeMeter: RequestMeter;
  /** The x-opencode-session of this run. */
  sessionId: string;
}

export function evalModels(env: EvalEnv): EvalModels {
  const geminiMeter = requestMeter({
    fetch: globalThis.fetch,
    minIntervalMs: GEMINI_MIN_INTERVAL_MS,
  });
  const openCodeMeter = requestMeter({ fetch: globalThis.fetch });
  const sessionId = randomUUID();
  const openCode = createOpenAICompatible({
    name: "opencode-go",
    baseURL: env.openCodeBaseURL,
    apiKey: env.openCodeKey,
    // Without the session header OpenCode Go answers MissingSessionID.
    headers: {
      "User-Agent": EVAL_USER_AGENT,
      "x-opencode-session": sessionId,
    },
    supportsStructuredOutputs: true,
    includeUsage: true,
    fetch: openCodeMeter.fetch,
  });
  return {
    gemini: createGoogleGenerativeAI({
      apiKey: env.geminiKey,
      fetch: geminiMeter.fetch,
    })(ATOMY_MODEL_ID),
    judge: openCode(JUDGE_MODEL_ID),
    reader: openCode(READER_MODEL_ID),
    geminiMeter,
    openCodeMeter,
    sessionId,
  };
}
