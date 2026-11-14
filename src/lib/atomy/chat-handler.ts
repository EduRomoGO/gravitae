// The chat with Atomy on the lesson, server side: the chat of every surface
// (surface-chat-handler.ts) with the lesson's request, prompt and tools.

import type { Tool } from "ai";
import { CALC_TOOLS, CALC_TOOL_NAMES } from "@/lib/atomy/calc-tools";
import {
  PAGE_TOOLS,
  offeredPageTools,
  sectionTools,
} from "@/lib/atomy/client-tools";
import {
  CHAT_INSTRUCTIONS,
  CHAT_PROMPT_VERSION,
  chatConversation,
} from "@/lib/atomy/chat-prompt";
import {
  parseChatRequest,
  type ChatRequest,
  type ChatSnapshot,
} from "@/lib/atomy/chat-request";
import {
  createSurfaceChatHandler,
  type ChatHandlerOptions,
  type ChatSurfaceServer,
} from "@/lib/atomy/surface-chat-handler";

/** Every tool of the chat: the calculations and the tools of the page. */
export const CHAT_TOOLS = { ...CALC_TOOLS, ...PAGE_TOOLS };

export type ChatToolName = keyof typeof CHAT_TOOLS;

/**
 * The tools of a request, set_widget with the schemas of the visible
 * section's widgets only.
 */
export function chatTools(snapshot: ChatSnapshot): Record<ChatToolName, Tool> {
  return {
    ...CHAT_TOOLS,
    ...sectionTools(snapshot.widgets.map(({ widget }) => widget)),
  };
}

/**
 * The tools a request offers: the calculations, the move to
 * a section, and the widgets of the visible section while it has them on the page.
 * The section is fixed for the whole request, so every step offers the same.
 */
export function chatActiveTools(snapshot: ChatSnapshot): ChatToolName[] {
  return [...CALC_TOOL_NAMES, ...offeredPageTools(snapshot)];
}

const LESSON_SURFACE: ChatSurfaceServer<ChatRequest> = {
  endpoint: "chat",
  functionId: "atomy-chat",
  instructions: CHAT_INSTRUCTIONS,
  promptVersion: CHAT_PROMPT_VERSION,
  parse: parseChatRequest,
  conversation: ({ messages, snapshot }) =>
    chatConversation(messages, snapshot),
  tools: ({ snapshot }) => chatTools(snapshot),
  activeTools: ({ snapshot }) => chatActiveTools(snapshot),
};

/** The chat with Atomy on the lesson. */
export function createChatHandler(
  options: ChatHandlerOptions,
): (request: Request) => Promise<Response> {
  return createSurfaceChatHandler(LESSON_SURFACE, options);
}
