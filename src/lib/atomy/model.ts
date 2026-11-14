import type { LanguageModel } from "ai";

// The Gemini models every call to the language model uses:
// versioned ids, never a "latest" alias, changed here in one line. The
// first is the one the prompts and the eval are measured with; the others
// answer only when the ones before them have run out of quota, which Google
// counts per project and per model (lib/atomy/model-fallback.ts).
export const ATOMY_MODEL_IDS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
] as const;

/** The main model: the one measured, probed and named in the logs. */
export const ATOMY_MODEL_ID = ATOMY_MODEL_IDS[0];

/** The id the measurements report: the model's own, whatever passes it. */
export function modelIdOf(model: LanguageModel): string {
  return typeof model === "string" ? model : model.modelId;
}
