// The programmatic checks of the eval: what code can tell of the model's free
// text without a judge. Each takes the text and gives a yes or no; the cases
// decide which apply.

import { OUT_OF_SCOPE_REPLY } from "@/lib/atomy/chat-prompt";

/** Lower case, without accents and with single spaces, to compare words. */
export function normalized(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function withoutQuotes(text: string): string {
  return text.replace(/^[«"“\s]+|[»"”\s]+$/g, "");
}

/** Whether the text is the fixed reply to a question outside the lesson. */
export function isOutOfScopeReply(text: string): boolean {
  return (
    normalized(withoutQuotes(text)) ===
    normalized(withoutQuotes(OUT_OF_SCOPE_REPLY))
  );
}

const MARKUP = [
  /\*\*|__|`/, // bold, code
  /^\s*#{1,6}\s/m, // heading
  /^\s*([-*+]|\d+\.)\s/m, // list
  /!?\[[^\]]*\]\([^)]*\)/, // link or image
  /https?:\/\/|www\./i, // bare link
  /<\/?[a-z][^>]*>/i, // HTML
];

/** Whether the text is plain: no Markdown, links, images or HTML. */
export function isPlainText(text: string): boolean {
  return MARKUP.every((pattern) => !pattern.test(text));
}

/** The sentences of the text: a stop followed by a space or the end. */
export function sentenceCount(text: string): number {
  return text
    .split(/[.!?…]+(?=\s|$)/)
    .filter((sentence) => /\p{L}|\p{N}/u.test(sentence)).length;
}

/** Whether the text says any of the phrases, without case or accents. */
export function mentionsAny(text: string, phrases: readonly string[]): boolean {
  const haystack = normalized(text);
  return phrases.some((phrase) => haystack.includes(normalized(phrase)));
}

const VERDICT_WORDS =
  /\b(exacto|correct[oa]s?|incorrect[oa]s?|acertad[oa]s?|aciertas?|bien visto|tienes razon|equivocad[oa]s?|te equivocas|la respuesta es)\b/;

/**
 * The reader's own request for the answer, which the feedback may echo
 * («pides que te diga cuál es la correcta») without telling it.
 */
const ASKED_FOR = /cual es la (respuesta )?correcta/g;

/**
 * Whether the text tells the reader if they got it right, which a prediction
 * still to check must not (the correction's prompt, «<revelada>»).
 */
export function confirmsAnswer(text: string): boolean {
  return VERDICT_WORDS.test(normalized(text).replace(ASKED_FOR, ""));
}
