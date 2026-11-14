// A prediction of the lesson as the endpoints that call the model receive it:
// its id, the question, the option the reader chose and whether they checked
// it. The chat (chat-request.ts) and the reasoning's correction
// (correction-request.ts) extend it with what each needs, so both receive it
// with the same limits.

import { z } from "zod";
import { PREDICTION_IDS } from "@/lib/lesson/predictions";

export const MAX_QUESTION_CHARS = 400;
/** The longest answer, the reader's or the right one. */
export const MAX_OPTION_CHARS = 120;

/** One answer to a prediction, the reader's or the right one, as text. */
export const answerText = z.string().min(1).max(MAX_OPTION_CHARS);

export const predictionBase = z.strictObject({
  id: z.enum(PREDICTION_IDS),
  question: z.string().min(1).max(MAX_QUESTION_CHARS),
  chosen: answerText,
  revealed: z.boolean(),
});
