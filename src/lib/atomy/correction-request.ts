// The contract of the reasoning's correction, shared by the prediction and
// its route handler. The request is validated with Zod before anything
// reaches the model: the section the prediction is in, the prediction with
// its id, the reader's answer and the right one, both as text (an option, an
// order…), and whether the right one is revealed, and the reader's
// reasoning. The answer is the correction, or an error code.

import { z } from "zod";
import {
  MAX_SECTION_TEXT_CHARS,
  MAX_SECTION_TITLE_CHARS,
} from "@/lib/atomy/lesson-limits";
import { MISCONCEPTION_IDS } from "@/lib/lesson/misconceptions";
import {
  PREDICTION_SECTIONS,
  PREDICTION_SECTION_IDS,
} from "@/lib/lesson/predictions";
import { VERDICTS } from "@/lib/lesson/verdicts";
import { MODEL_ERROR_CODES } from "@/lib/atomy/model-error-codes";
import { answerText, predictionBase } from "@/lib/atomy/prediction";
import { parseRequestBody, type ParsedRequest } from "@/lib/atomy/request-body";

/** Three sentences of feedback, with room to spare. */
export const CORRECTION_MAX_FEEDBACK_CHARS = 500;

/**
 * What the prediction learns of a failure: the model's own failures, or an
 * output that broke the rules twice.
 */
export const CORRECTION_ERROR_CODES = [
  ...MODEL_ERROR_CODES,
  "invalid-output",
] as const;

export type CorrectionErrorCode = (typeof CORRECTION_ERROR_CODES)[number];

/** The code of a failed answer; any code the prediction does not know is the provider's. */
export const correctionErrorCodeSchema = z
  .enum(CORRECTION_ERROR_CODES)
  .catch("provider");

/** The handler's answer, as the prediction reads it back. */
export const correctionAnswerSchema = z.object({
  verdict: z.enum(VERDICTS),
  misconception: z.enum(MISCONCEPTION_IDS).nullable(),
  feedback: z.string().min(1).max(CORRECTION_MAX_FEEDBACK_CHARS),
});

export type Correction = z.infer<typeof correctionAnswerSchema>;

/**
 * The handler's answer with whether a fallback model wrote it, because the
 * main one had run out of quota: the prediction warns that it may be worse.
 */
export const correctionResponseSchema = correctionAnswerSchema.extend({
  fallback: z.literal(true).exactOptional(),
});

export type CorrectionResponse = z.infer<typeof correctionResponseSchema>;

/** The longest reasoning, shown next to its field. */
export const MAX_REASONING_CHARS = 300;
/** The whole JSON body; checked before parsing it. */
export const MAX_CORRECTION_BODY_CHARS = 10_000;

export const correctionRequestSchema = z
  .strictObject({
    section: z.strictObject({
      id: z.enum(PREDICTION_SECTION_IDS),
      title: z.string().min(1).max(MAX_SECTION_TITLE_CHARS),
      text: z.string().min(1).max(MAX_SECTION_TEXT_CHARS),
    }),
    prediction: predictionBase.extend({ answer: answerText }),
    reasoning: z.string().trim().min(1).max(MAX_REASONING_CHARS),
  })
  .refine(
    ({ section, prediction }) =>
      PREDICTION_SECTIONS[prediction.id] === section.id,
    "the section is the prediction's",
  );

export type CorrectionRequest = z.infer<typeof correctionRequestSchema>;

/** The request, or why the body is not a valid correction request. */
export function parseCorrectionRequest(
  body: string,
): ParsedRequest<CorrectionRequest> {
  return parseRequestBody(body, {
    schema: correctionRequestSchema,
    maxChars: MAX_CORRECTION_BODY_CHARS,
  });
}
