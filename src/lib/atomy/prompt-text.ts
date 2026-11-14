// The text every prompt of Atomy shares: the reader's text kept from closing
// or opening the prompt's tags, and the conversation as the model reads it,
// with the page block of the surface before the reader's last question.

import type { UIMessage } from "ai";

/** Keeps the reader's text from closing or opening the prompt's tags. */
export function escapeTags(text: string): string {
  return text.replaceAll("<", "‹").replaceAll(">", "›");
}

function questionOf(message: UIMessage): string {
  const text = message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
  return `<pregunta_del_lector>\n${escapeTags(text)}\n</pregunta_del_lector>`;
}

/**
 * The conversation as the model reads it, on any surface: every reader
 * message delimited as a question, and the last one preceded by `pageBlock`,
 * what the reader has on the page.
 */
export function conversationWith(
  messages: readonly UIMessage[],
  pageBlock: string,
): UIMessage[] {
  const lastUser = messages.findLastIndex((message) => message.role === "user");
  return messages.map((message, index) => {
    if (message.role !== "user") return message;
    const question = questionOf(message);
    const text = index === lastUser ? `${pageBlock}\n\n${question}` : question;
    return { ...message, parts: [{ type: "text", text }] };
  });
}
