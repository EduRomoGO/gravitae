// The JSON body of a request to an endpoint that calls the model, validated
// with Zod before anything reaches the model. A body
// that does not pass says why, for the request's log.

import type { z } from "zod";

/** Why a body was not a valid request. */
export type RequestRejection =
  | { reason: "body-too-long"; chars: number; maxChars: number }
  /** Above the bytes a body of the most characters can take, unread past them. */
  | { reason: "body-too-large"; bytes: number; maxBytes: number }
  | { reason: "invalid-json" }
  | {
      reason: "invalid-schema";
      issues: { path: string; message: string }[];
    };

export type ParsedRequest<T> =
  { success: true; data: T } | { success: false; rejection: RequestRejection };

/** The body as a request of the schema, or the reason it is not one. */
export function parseRequestBody<T>(
  body: string,
  { schema, maxChars }: { schema: z.ZodType<T>; maxChars: number },
): ParsedRequest<T> {
  if (body.length > maxChars) {
    return {
      success: false,
      rejection: { reason: "body-too-long", chars: body.length, maxChars },
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { success: false, rejection: { reason: "invalid-json" } };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return { success: true, data: parsed.data };
  return {
    success: false,
    rejection: {
      reason: "invalid-schema",
      issues: parsed.error.issues.map(({ path, message }) => ({
        path: path.map(String).join("."),
        message,
      })),
    },
  };
}

/**
 * The most bytes a body of `maxChars` characters takes in UTF-8: up to three
 * per UTF-16 code unit. A longer body is rejected before it is read whole.
 */
export function maxBodyBytes(maxChars: number): number {
  return maxChars * 3;
}

/**
 * The request's body as text, read only while it fits in the bytes of
 * `maxChars` characters: a body its content-length declares larger is not
 * read at all, and one without that header stops being read once it grows
 * past them. The characters are checked when the body is parsed.
 */
export async function readRequestBody(
  request: Request,
  maxChars: number,
): Promise<
  | { success: true; text: string }
  | { success: false; rejection: RequestRejection }
> {
  const maxBytes = maxBodyBytes(maxChars);
  const tooLarge = (bytes: number) => ({
    success: false as const,
    rejection: { reason: "body-too-large" as const, bytes, maxBytes },
  });
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return tooLarge(declared);
  }
  if (request.body === null) return { success: true, text: "" };
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      return tooLarge(bytes);
    }
    text += decoder.decode(value, { stream: true });
  }
  return { success: true, text: text + decoder.decode() };
}
