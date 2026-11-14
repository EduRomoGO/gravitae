// What the chat makes of its messages, without React: how the last turn went,
// how Atomy looks, what is announced and how each message reads, with the
// line of each of Atomy's actions in its place.

import type { ChatStatus, InferUITools, UIDataTypes, UIMessage } from "ai";
import type { AtomyState } from "@/components/atomy/atomy";
import { FALLBACK_NOTE } from "@/components/atomy/fallback-note";
import type { CALC_TOOLS } from "@/lib/atomy/calc-tools";
import type {
  ChatAnswerMetadata,
  ChatErrorCode,
} from "@/lib/atomy/surface-chat-handler";
import {
  isSurfaceToolPartType,
  surfaceActionLine,
  type SurfaceToolTypes,
} from "@/lib/atomy/surface-tools";

/**
 * The chat's tools: the calculations, and the page's of every surface by
 * their own types.
 */
export type ChatTools = InferUITools<typeof CALC_TOOLS> & SurfaceToolTypes;

export type ChatMessage = UIMessage<ChatAnswerMetadata, UIDataTypes, ChatTools>;

/** The chat as far as its outcome needs it. */
export interface ChatState {
  readonly status: ChatStatus;
  readonly error?: Error | undefined;
  readonly messages: readonly ChatMessage[];
}

/** How the last turn went, once it is over. */
export type ChatTurnOutcome = "answered" | "rate-limit" | "failed";

/** A piece of a message: what Atomy or the reader wrote, or what Atomy did. */
export interface Segment {
  kind: "text" | "action";
  text: string;
}

export interface Message {
  key: string;
  from: "atomy" | "reader";
  text: string;
  segments: Segment[];
  /** What the reader should know about how the answer ended. */
  note?: string | undefined;
}

const INCOMPLETE_NOTE = "Respuesta incompleta: se cortó por su longitud.";
const BLOCKED_NOTE =
  "Atomy no puede responder a esa pregunta. Prueba a preguntarlo de otra forma.";
export const RATE_LIMIT_TEXT = "Límite de uso alcanzado, inténtalo más tarde.";
export const FAILURE_TEXT =
  "Atomy no ha podido responder. Puedes reintentarlo o seguir leyendo.";

/** The greeting is the chat's own: it never reaches the model. */
function greeting(context: string | undefined): Message {
  const text = context
    ? "¿Qué duda tienes sobre este experimento?"
    : "¿En qué te puedo ayudar?";
  return {
    key: "greeting",
    from: "atomy",
    text,
    segments: [{ kind: "text", text }],
  };
}

/** The message's text and the lines of Atomy's actions, in their order. */
function segmentsOf(message: ChatMessage): Segment[] {
  const segments: Segment[] = [];
  for (const part of message.parts) {
    const line = "toolCallId" in part ? surfaceActionLine(part) : undefined;
    const piece: Segment | undefined =
      part.type === "text"
        ? { kind: "text", text: part.text }
        : line
          ? { kind: "action", text: line }
          : undefined;
    if (!piece) continue;
    const previous = segments.at(-1);
    if (piece.kind === "text" && previous?.kind === "text")
      previous.text += piece.text;
    else segments.push(piece);
  }
  return segments;
}

/** The answer's last tool is one of the page's, which the chat just ran. */
export function endsWithPageTool(message: ChatMessage | undefined): boolean {
  const lastTool = message?.parts.findLast((part) => "toolCallId" in part);
  return lastTool !== undefined && isSurfaceToolPartType(lastTool.type);
}

/** How the answer ended, when it did not end on its own: Atomy stops. */
function endNoteOf(message: ChatMessage | undefined): string | undefined {
  const reason = message?.metadata?.finishReason;
  if (reason === "length") return INCOMPLETE_NOTE;
  if (reason === "content-filter") return BLOCKED_NOTE;
  return undefined;
}

/** Everything the reader should know about the answer besides its text. */
function noteOf(message: ChatMessage | undefined): string | undefined {
  const notes = [
    endNoteOf(message),
    message?.metadata?.fallback ? FALLBACK_NOTE : undefined,
  ].filter((note) => note !== undefined);
  return notes.length > 0 ? notes.join(" ") : undefined;
}

/**
 * An answer that ended in anything but its own end, or a tool call the chat
 * no longer follows, did not answer: an error, or a reason Gemini gives
 * without a word of why.
 */
function endedUnanswered(message: ChatMessage | undefined): boolean {
  const reason = message?.metadata?.finishReason;
  return reason === "error" || reason === "other";
}

function textOf(message: ChatMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

export function isBusy(status: ChatStatus): boolean {
  return status === "submitted" || status === "streaming";
}

function lastAnswerOf(chat: ChatState): ChatMessage | undefined {
  const last = chat.messages.at(-1);
  return last?.role === "assistant" ? last : undefined;
}

/** How the last turn went; undefined while it goes on or before any. */
export function outcomeOf(chat: ChatState): ChatTurnOutcome | undefined {
  if (isBusy(chat.status)) return undefined;
  if (chat.error)
    return chat.error.message === ("rate-limit" satisfies ChatErrorCode)
      ? "rate-limit"
      : "failed";
  const lastAnswer = lastAnswerOf(chat);
  if (endedUnanswered(lastAnswer)) return "failed";
  return lastAnswer ? "answered" : undefined;
}

/** What the chat shows and announces of the conversation. */
export interface ConversationView {
  readonly messages: Message[];
  readonly outcome: ChatTurnOutcome | undefined;
  readonly atomyState: AtomyState;
  /** Atomy is thinking: the answer has no text yet. */
  readonly thinking: boolean;
  /** The finished answer or its failure, for the polite live region. */
  readonly announcement: string;
}

export function viewOf(
  chat: ChatState,
  context: string | undefined,
): ConversationView {
  const busy = isBusy(chat.status);
  const lastAnswer = lastAnswerOf(chat);
  const outcome = outcomeOf(chat);
  // Atomy stops when the answer fails or ends cut short.
  const atomyState: AtomyState = busy
    ? "talking"
    : outcome === "failed" ||
        outcome === "rate-limit" ||
        endNoteOf(lastAnswer) !== undefined
      ? "stopped"
      : "idle";
  const announcement =
    outcome === "rate-limit"
      ? RATE_LIMIT_TEXT
      : outcome === "failed"
        ? FAILURE_TEXT
        : outcome === "answered" && lastAnswer
          ? [textOf(lastAnswer), noteOf(lastAnswer)].filter(Boolean).join(" ")
          : "";
  return {
    messages: [
      greeting(context),
      ...chat.messages.map((message): Message => ({
        key: message.id,
        from: message.role === "user" ? "reader" : "atomy",
        text: textOf(message),
        segments: segmentsOf(message),
        note: message.role === "assistant" ? noteOf(message) : undefined,
      })),
    ],
    outcome,
    atomyState,
    thinking: busy && !(lastAnswer && textOf(lastAnswer)),
    announcement,
  };
}
