// The body the chat sends to the finder's route handler, validated with Zod
// before anything reaches the model, like the lesson's (chat-request.ts): the
// messages of every surface (chat-messages.ts), with the finder's tools, and
// the finder's state.

import { z } from "zod";
import {
  assistantMessageWith,
  endsWithTheReader,
  MAX_BODY_CHARS,
  MAX_MESSAGES,
  pageToolPart,
  refusedCallPart,
  userMessage,
} from "@/lib/atomy/chat-messages";
import {
  closureSummary,
  FINDER_TOOL_NAMES,
  FINDER_TOOL_PART_TYPES,
  FINDER_TOOLS,
  seedSchema,
  simulationSummary,
} from "@/lib/atomy/finder-tools";
import { parseRequestBody, type ParsedRequest } from "@/lib/atomy/request-body";
import { MAX_TIME_LIMITS } from "@/lib/orbits/search";

const assistantMessage = assistantMessageWith([
  ...FINDER_TOOL_NAMES.map((name) =>
    pageToolPart(
      name,
      FINDER_TOOLS[name].schemas.input,
      FINDER_TOOLS[name].schemas.output,
    ),
  ),
  refusedCallPart(FINDER_TOOL_NAMES),
]);

/** What the reader has on the finder when they ask. */
export const finderSnapshotSchema = z.strictObject({
  seed: seedSchema,
  maxTime: z.number().min(MAX_TIME_LIMITS.min).max(MAX_TIME_LIMITS.max),
  simulation: z.discriminatedUnion("status", [
    z.strictObject({ status: z.literal("running") }),
    z.strictObject({ status: z.literal("failed") }),
    z.strictObject({ status: z.literal("done"), summary: simulationSummary }),
  ]),
  closure: z.discriminatedUnion("status", [
    z.strictObject({ status: z.literal("idle") }),
    z.strictObject({ status: z.literal("running") }),
    z.strictObject({ status: z.literal("failed") }),
    z.strictObject({ status: z.literal("done"), summary: closureSummary }),
  ]),
});

export type FinderSnapshot = z.infer<typeof finderSnapshotSchema>;

export const finderChatRequestSchema = z.object({
  messages: z
    .array(z.discriminatedUnion("role", [userMessage, assistantMessage]))
    .min(1)
    .max(MAX_MESSAGES)
    .refine((messages) => endsWithTheReader(messages, FINDER_TOOL_PART_TYPES), {
      message:
        "the last message is the reader's question, or Atomy's answer with the page's results",
    }),
  snapshot: finderSnapshotSchema,
});

export type FinderChatRequest = z.infer<typeof finderChatRequestSchema>;

export function parseFinderChatRequest(
  body: string,
): ParsedRequest<FinderChatRequest> {
  return parseRequestBody(body, {
    schema: finderChatRequestSchema,
    maxChars: MAX_BODY_CHARS,
  });
}
