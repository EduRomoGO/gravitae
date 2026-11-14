// The correction of the reader's reasoning in a prediction. Without the
// Gemini key the handler answers with the reduced mode. The log of each
// request goes to the server's console and to logs/atomy/ in development
// only.

import { createCorrectionHandler } from "@/lib/atomy/correction-handler";
import { geminiModel } from "@/lib/atomy/gemini";
import { devLogSink } from "@/lib/atomy/request-log-file";

// Both attempts of the correction at their timeout (2 × CORRECTION_TIMEOUT_MS,
// 40 s) with margin, so the handler's own error answers before the platform
// cuts the response. Next reads it from the source, so it is a literal:
// max-duration.test.ts checks it.
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const handle = createCorrectionHandler({
    model: geminiModel(),
    ...(process.env.NODE_ENV === "development" ? { log: devLogSink() } : {}),
  });
  return handle(request);
}
