// The codes that name a failed call to the model to the reader's interface
// (model-errors.ts tells which one applies). Apart from model-errors.ts, which
// reads the AI SDK's errors, so the browser gets the codes without the SDK.

export const MODEL_ERROR_CODES = ["rate-limit", "provider"] as const;

export type ModelErrorCode = (typeof MODEL_ERROR_CODES)[number];
