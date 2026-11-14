// The chat with Atomy on the orbit finder, server side: the chat of every
// surface (surface-chat-handler.ts) with the finder's request, prompt and
// tools.

import {
  createSurfaceChatHandler,
  type ChatHandlerOptions,
  type ChatSurfaceServer,
} from "@/lib/atomy/surface-chat-handler";
import {
  parseFinderChatRequest,
  type FinderChatRequest,
} from "@/lib/atomy/finder-chat-request";
import {
  FINDER_INSTRUCTIONS,
  FINDER_PROMPT_VERSION,
  finderConversation,
} from "@/lib/atomy/finder-chat-prompt";
import { FINDER_TOOL_NAMES, FINDER_TOOLS } from "@/lib/atomy/finder-tools";

export const FINDER_SURFACE: ChatSurfaceServer<FinderChatRequest> = {
  endpoint: "finder-chat",
  functionId: "atomy-finder-chat",
  instructions: FINDER_INSTRUCTIONS,
  promptVersion: FINDER_PROMPT_VERSION,
  parse: parseFinderChatRequest,
  conversation: ({ messages, snapshot }) =>
    finderConversation(messages, snapshot),
  tools: () => FINDER_TOOLS,
  activeTools: () => [...FINDER_TOOL_NAMES],
};

export function createFinderChatHandler(
  options: ChatHandlerOptions,
): (request: Request) => Promise<Response> {
  return createSurfaceChatHandler(FINDER_SURFACE, options);
}
