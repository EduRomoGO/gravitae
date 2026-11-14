// The body the chat sends to the lesson's route handler, validated with Zod
// before anything reaches the model: the messages of
// every surface (chat-messages.ts), with the lesson's tools, and the lesson's
// snapshot.

import { z } from "zod";
import {
  CALC_TOOL_NAMES,
  type CalcToolName,
  computeForceFactorInput,
  computeForceFactorOutput,
  fallTimeInput,
  fallTimeOutput,
  weightOnInput,
  weightOnOutput,
} from "@/lib/atomy/calc-tools";
import {
  PAGE_TOOL_NAMES,
  PAGE_TOOLS,
  PAGE_TOOL_PART_TYPES,
} from "@/lib/atomy/client-tools";
import { WIDGET_SECTIONS, widgetChange } from "@/lib/lesson/widgets";
import {
  MAX_EXPERIMENT_CHARS,
  MAX_SECTION_TEXT_CHARS,
  MAX_SECTION_TITLE_CHARS,
} from "@/lib/atomy/lesson-limits";
import { SECTION_IDS } from "@/lib/lesson/sections";
import { predictionBase } from "@/lib/atomy/prediction";
import { VERDICTS } from "@/lib/lesson/verdicts";
import {
  MAX_BODY_CHARS,
  MAX_MESSAGES,
  assistantMessageWith,
  endsWithTheReader,
  pageToolPart,
  providerMetadata,
  refusedCallPart,
  toolCallId,
  userMessage,
} from "@/lib/atomy/chat-messages";
import { parseRequestBody, type ParsedRequest } from "@/lib/atomy/request-body";

export {
  MAX_EXPERIMENT_CHARS,
  MAX_SECTION_TEXT_CHARS,
  MAX_SECTION_TITLE_CHARS,
};

/**
 * A calculation the server already ran, as useChat sends it back: finished,
 * with an input and an output that fit the tool's schemas.
 */
function calculationPart(
  name: CalcToolName,
  input: z.ZodType,
  output: z.ZodType,
) {
  return z.strictObject({
    type: z.literal(`tool-${name}`),
    toolCallId,
    state: z.literal("output-available"),
    input,
    output,
    providerExecuted: z.boolean().exactOptional(),
    callProviderMetadata: providerMetadata,
    resultProviderMetadata: providerMetadata,
  });
}

/** Every tool of the page's part, with that tool's schemas. */
const pageToolParts = PAGE_TOOL_NAMES.map((name) =>
  pageToolPart(
    name,
    PAGE_TOOLS[name].schemas.input,
    PAGE_TOOLS[name].schemas.output,
  ),
);

const assistantMessage = assistantMessageWith([
  calculationPart(
    "compute_force_factor",
    computeForceFactorInput,
    computeForceFactorOutput,
  ),
  calculationPart("weight_on", weightOnInput, weightOnOutput),
  calculationPart("fall_time", fallTimeInput, fallTimeOutput),
  ...pageToolParts,
  refusedCallPart([...CALC_TOOL_NAMES, ...PAGE_TOOL_NAMES]),
]);

/** Above the most widgets a section has. */
export const MAX_SECTION_WIDGETS = 4;

/** Above the predictions the lesson has. */
export const MAX_PREDICTIONS = 12;

/**
 * A prediction the reader made: the option they chose, whether they checked
 * it and, once Atomy corrected their reasoning, its verdict. Its section is
 * PREDICTION_SECTIONS[id].
 */
export const predictionMade = predictionBase.extend({
  verdict: z.enum(VERDICTS).exactOptional(),
});

export type PredictionMade = z.infer<typeof predictionMade>;

/** What the reader is looking at when they ask: the visible section. */
export const chatSnapshotSchema = z
  .strictObject({
    section: z.strictObject({
      id: z.enum(SECTION_IDS),
      title: z.string().min(1).max(MAX_SECTION_TITLE_CHARS),
      text: z.string().min(1).max(MAX_SECTION_TEXT_CHARS),
    }),
    /** The question of the experiment the chat was opened from, if any. */
    experiment: z.string().min(1).max(MAX_EXPERIMENT_CHARS).exactOptional(),
    /** The widgets of the visible section on the page, with their state. */
    widgets: z.array(widgetChange).max(MAX_SECTION_WIDGETS).default([]),
    /** Every prediction the reader made in the lesson. */
    predictions: z.array(predictionMade).max(MAX_PREDICTIONS).default([]),
  })
  .refine(
    ({ section, widgets }) =>
      widgets.every(({ widget }) => WIDGET_SECTIONS[widget] === section.id),
    "every widget belongs to the visible section",
  );

export type ChatSnapshot = z.infer<typeof chatSnapshotSchema>;

/** A snapshot as sent, with the lists the schema defaults left out. */
export type ChatSnapshotInput = z.input<typeof chatSnapshotSchema>;

// The transport's own fields (id, trigger, messageId) are dropped.
export const chatRequestSchema = z.object({
  messages: z
    .array(z.discriminatedUnion("role", [userMessage, assistantMessage]))
    .min(1)
    .max(MAX_MESSAGES)
    .refine((messages) => endsWithTheReader(messages, PAGE_TOOL_PART_TYPES), {
      message:
        "the last message is the reader's question, or Atomy's answer with the page's results",
    }),
  snapshot: chatSnapshotSchema,
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** The request, or why the body is not a valid chat request. */
export function parseChatRequest(body: string): ParsedRequest<ChatRequest> {
  return parseRequestBody(body, {
    schema: chatRequestSchema,
    maxChars: MAX_BODY_CHARS,
  });
}
