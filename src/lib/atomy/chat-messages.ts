// The messages every surface of the chat sends to its route handler, as Zod
// schemas: the reader's questions and Atomy's answers with the tool parts of
// the surface, and the bounds of the conversation. Each surface's request
// (chat-request.ts, finder-chat-request.ts) builds its own assistant message
// from these builders with its tools. useChat resends the whole history,
// assistant messages included: they are accepted only with the parts the chat
// produces, and not signed (an accepted risk). The parts the model itself produced outside the
// limits are dropped or cut before validating, so that one failure of the
// model does not reject every later question of the conversation.

import { z } from "zod";

/** The history kept per request: about ten questions with their answers. */
export const MAX_MESSAGES = 20;
/** The longest question a reader can send. */
export const MAX_MESSAGE_CHARS = 1000;
/** Above what CHAT_MAX_OUTPUT_TOKENS lets an answer reach. */
export const MAX_ASSISTANT_MESSAGE_CHARS = 4000;
/** Above the longest error the AI SDK writes for an invalid tool call. */
export const MAX_TOOL_ERROR_CHARS = 2000;
/** The whole JSON body; checked before parsing it. */
export const MAX_BODY_CHARS = 100_000;

/** How the page answers a tool of the page, on every surface. */
export type PageToolResult<Output> =
  | { readonly ok: true; readonly output: Output }
  | { readonly ok: false; readonly error: string };

export const providerMetadata = z
  .record(z.string(), z.record(z.string(), z.json()))
  .exactOptional();

function textPart(maxChars: number) {
  return z.strictObject({
    type: z.literal("text"),
    text: z.string().max(maxChars),
    state: z.enum(["streaming", "done"]).exactOptional(),
    providerMetadata,
  });
}

function totalText(parts: readonly { type: string; text?: string }[]): number {
  return parts.reduce((sum, part) => sum + (part.text?.length ?? 0), 0);
}

export const toolCallId = z.string().max(100);

/**
 * A tool of the page, as the chat sends it back after running it: with the
 * state it left the page in, or with the error the page answered with.
 */
function pageToolPartSchema(name: string, input: z.ZodType, output: z.ZodType) {
  const common = {
    type: z.literal(`tool-${name}`),
    toolCallId,
    input,
    providerExecuted: z.boolean().exactOptional(),
    callProviderMetadata: providerMetadata,
  };
  return z.discriminatedUnion("state", [
    z.strictObject({
      ...common,
      state: z.literal("output-available"),
      output,
      resultProviderMetadata: providerMetadata,
    }),
    z.strictObject({
      ...common,
      state: z.literal("output-error"),
      errorText: z.string().max(MAX_TOOL_ERROR_CHARS),
    }),
  ]);
}

/** Above the longest input of a call to any tool of the chat. */
export const MAX_TOOL_INPUT_CHARS = 1000;

/**
 * A call the AI SDK refused before running it: its input did not fit the
 * tool's schema, or the tool was not among those the request offered. It
 * comes back as a dynamic tool, with the error the model received instead of
 * an output. Its input cannot be checked against the tool's schema, because
 * both outcomes are legitimate: an input outside it, or a valid input to a
 * tool not offered then. It is bounded instead: an object, or the raw text
 * the model wrote when it was not JSON, no longer than any call of the chat.
 */
function refusedCallPartSchema(toolNames: readonly [string, ...string[]]) {
  return z.strictObject({
    type: z.literal("dynamic-tool"),
    toolName: z.enum(toolNames),
    toolCallId,
    state: z.literal("output-error"),
    input: z
      .union([z.record(z.string(), z.json()), z.string()])
      .refine(
        (input) =>
          (typeof input === "string" ? input : JSON.stringify(input)).length <=
          MAX_TOOL_INPUT_CHARS,
        "too long",
      ),
    errorText: z.string().max(MAX_TOOL_ERROR_CHARS),
    providerExecuted: z.boolean().exactOptional(),
    callProviderMetadata: providerMetadata,
  });
}

export const userMessage = z.strictObject({
  id: z.string().max(100),
  role: z.literal("user"),
  metadata: z.unknown().exactOptional(),
  parts: z
    .array(textPart(MAX_MESSAGE_CHARS))
    .min(1)
    .refine((parts) => totalText(parts) <= MAX_MESSAGE_CHARS, "too long")
    .refine((parts) => totalText(parts) > 0, "empty"),
});

/**
 * An answer of Atomy as the chat sends it back: its text, and the tool parts
 * of the surface it was given on.
 */
function assistantMessageSchema<
  const Parts extends readonly z.core.$ZodTypeDiscriminable[],
>(toolParts: Parts) {
  const part = z.discriminatedUnion("type", [
    textPart(MAX_ASSISTANT_MESSAGE_CHARS),
    z.strictObject({ type: z.literal("step-start") }),
    ...toolParts,
  ]);
  return z.strictObject({
    id: z.string().max(100),
    role: z.literal("assistant"),
    metadata: z.unknown().exactOptional(),
    parts: z.preprocess(
      withinLimits(part),
      z
        .array(part)
        .refine(
          (parts: readonly unknown[]) =>
            totalText(parts.filter(hasText)) <= MAX_ASSISTANT_MESSAGE_CHARS,
          "too long",
        ),
    ),
  });
}

function hasText(part: unknown): part is { type: string; text: string } {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    typeof part.type === "string" &&
    "text" in part &&
    typeof part.text === "string"
  );
}

/**
 * The parts of an answer the model itself can produce outside the limits,
 * made to fit them before validating: a call the AI SDK refused that the
 * surface's parts do not accept (to a tool the surface does not have, or with
 * an input longer than any call of the chat) is dropped, so the model never
 * reads it; the text beyond MAX_ASSISTANT_MESSAGE_CHARS is cut. Any other
 * part outside the schema still rejects the request.
 */
function withinLimits(part: z.ZodType) {
  return (parts: unknown): unknown => {
    if (!Array.isArray(parts)) return parts;
    let room = MAX_ASSISTANT_MESSAGE_CHARS;
    return parts.flatMap((candidate: unknown) => {
      if (isRefusedCall(candidate)) {
        return part.safeParse(candidate).success ? [candidate] : [];
      }
      if (hasText(candidate) && candidate.type === "text") {
        const text = candidate.text.slice(0, room);
        room -= text.length;
        return text.length > 0 || candidate.text.length === 0
          ? [{ ...candidate, text }]
          : [];
      }
      return [candidate];
    });
  };
}

function isRefusedCall(part: unknown): boolean {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    part.type === "dynamic-tool" &&
    "state" in part &&
    part.state === "output-error"
  );
}

// The builders each surface uses for its own request, typed by the schemas
// they build.
export type PageToolPart = ReturnType<typeof pageToolPartSchema>;
export type RefusedCallPart = ReturnType<typeof refusedCallPartSchema>;
export type AssistantMessage<
  Parts extends readonly z.core.$ZodTypeDiscriminable[],
> = ReturnType<typeof assistantMessageSchema<Parts>>;

export function pageToolPart(
  name: string,
  input: z.ZodType,
  output: z.ZodType,
): PageToolPart {
  return pageToolPartSchema(name, input, output);
}

export function refusedCallPart(
  toolNames: readonly [string, ...string[]],
): RefusedCallPart {
  return refusedCallPartSchema(toolNames);
}

export function assistantMessageWith<
  const Parts extends readonly z.core.$ZodTypeDiscriminable[],
>(toolParts: Parts): AssistantMessage<Parts> {
  return assistantMessageSchema(toolParts);
}

/**
 * A conversation ends with the reader's question or, when the chat resends it
 * by itself, with Atomy's answer whose page tools the page has just run.
 */
export function endsWithTheReader(
  messages: readonly { role: string; parts: readonly { type: string }[] }[],
  pageToolPartTypes: readonly string[],
): boolean {
  const last = messages.at(-1);
  if (last?.role === "user") return true;
  return (
    last?.role === "assistant" &&
    last.parts.some((part) => pageToolPartTypes.includes(part.type))
  );
}
