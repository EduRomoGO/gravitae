// The part of the conversation each request carries. The route handlers
// reject more than MAX_MESSAGES messages, and the chat keeps every message it
// shows, so a long conversation sends only its latest ones: those that fit,
// from a question of the reader on.

import { MAX_MESSAGES } from "@/lib/atomy/chat-messages";

/** The latest `max` messages at most, starting with one of the reader's. */
export function recentMessages<Message extends { readonly role: string }>(
  messages: readonly Message[],
  max: number = MAX_MESSAGES,
): Message[] {
  const recent = messages.slice(-max);
  const firstQuestion = recent.findIndex(({ role }) => role === "user");
  return firstQuestion === -1 ? recent : recent.slice(firstQuestion);
}
