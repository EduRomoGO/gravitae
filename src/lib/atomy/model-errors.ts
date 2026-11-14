// How the endpoints that call the model name a failed call to the reader's
// interface: a code it turns into words, never the provider's own message.
// Shared by the chat and the reasoning's correction.

import { APICallError, RetryError } from "ai";
import type { ModelErrorCode } from "@/lib/atomy/model-error-codes";

/** A 429 after the AI SDK's own retries, or any other failure. */
export function modelErrorCode(error: unknown): ModelErrorCode {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  return APICallError.isInstance(cause) && cause.statusCode === 429
    ? "rate-limit"
    : "provider";
}
