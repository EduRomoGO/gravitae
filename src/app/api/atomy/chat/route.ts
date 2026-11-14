// The chat with Atomy. Without the Gemini key the handler answers with the
// reduced mode. The log of each request goes to the server's console
// and to logs/atomy/ in development only.

import { createChatHandler } from "@/lib/atomy/chat-handler";
import { geminiModel } from "@/lib/atomy/gemini";
import { devLogSink } from "@/lib/atomy/request-log-file";

// The longest turn of the chat (CHAT_TIMEOUT.totalMs, 60 s) with margin, so the
// handler's own timeout answers before the platform cuts the response. Next
// reads it from the source, so it is a literal: max-duration.test.ts checks it.
export const maxDuration = 75;

export async function POST(request: Request): Promise<Response> {
  const handle = createChatHandler({
    model: geminiModel(),
    ...(process.env.NODE_ENV === "development" ? { log: devLogSink() } : {}),
  });
  return handle(request);
}
