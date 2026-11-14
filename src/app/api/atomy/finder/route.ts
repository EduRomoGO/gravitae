// The chat with Atomy on the orbit finder. Like the lesson's chat
// (../chat/route.ts): without the Gemini key it answers with the reduced
// mode, and the log of each request goes to logs/atomy/ in development only.

import { createFinderChatHandler } from "@/lib/atomy/finder-chat-handler";
import { geminiModel } from "@/lib/atomy/gemini";
import { devLogSink } from "@/lib/atomy/request-log-file";

// The longest turn of the chat (CHAT_TIMEOUT.totalMs, 60 s) with margin, so the
// handler's own timeout answers before the platform cuts the response. Next
// reads it from the source, so it is a literal: max-duration.test.ts checks it.
export const maxDuration = 75;

export async function POST(request: Request): Promise<Response> {
  const handle = createFinderChatHandler({
    model: geminiModel(),
    ...(process.env.NODE_ENV === "development" ? { log: devLogSink() } : {}),
  });
  return handle(request);
}
