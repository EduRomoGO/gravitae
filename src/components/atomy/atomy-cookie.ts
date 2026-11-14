// The cookies of Atomy: the one that remembers the reader has met
// Atomy. Plain module, not "use client", so the server can read the name.

export const ATOMY_INTRO_COOKIE = "atomy-intro";

/** Remembers that the reader has met Atomy, for a year. */
export function markAtomyIntroSeen(): void {
  document.cookie = `${ATOMY_INTRO_COOKIE}=seen; path=/; max-age=31536000; samesite=lax`;
}

export function forgetAtomyIntro(): void {
  document.cookie = `${ATOMY_INTRO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/**
 * The reader's choice in the header's switch («Modo reducido»): the advanced mode
 * («modo con IA», `"ia"`), with Atomy talking through the language model, or
 * the reduced mode («modo reducido», `"reduced"`), without it.
 */
export type AtomyModeChoice = "ia" | "reduced";

// The cookie that remembers the reader turned the reduced mode on with the
// header's switch. Without it the advanced mode is on: it is the default.
export const ATOMY_MODE_COOKIE = "atomy-modo";
export const REDUCED_MODE = "reduced" satisfies AtomyModeChoice;

/** The reader's choice of mode, by the cookie's value. */
export function choiceOfCookie(value: string | undefined): AtomyModeChoice {
  return value === REDUCED_MODE ? "reduced" : "ia";
}

/** Remembers the reader's choice of mode, for a year. */
export function saveModeChoice(choice: AtomyModeChoice): void {
  document.cookie =
    choice === "ia"
      ? `${ATOMY_MODE_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${ATOMY_MODE_COOKIE}=${REDUCED_MODE}; path=/; max-age=31536000; samesite=lax`;
}

function cookieValue(cookies: string, name: string): string | undefined {
  const entry = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry?.slice(name.length + 1);
}

/** The reader's choice of mode, from the browser's cookies. */
export function readModeChoice(cookies: string): AtomyModeChoice {
  return choiceOfCookie(cookieValue(cookies, ATOMY_MODE_COOKIE));
}

// The cookie the proxy (src/proxy.ts) sets on every page while the server has
// no key of the language model, and removes once it has one. The server
// reads the key per request, but most pages are built once: through the
// cookie, the page knows the reduced mode before its first paint
// (components/shared/atomy-mode-controls.tsx).
export const ATOMY_NO_KEY_COOKIE = "atomy-sin-clave";
export const NO_KEY = "1";

/** Whether the server had no key when it sent the page, by the cookies. */
export function readNoKey(cookies: string): boolean {
  return cookieValue(cookies, ATOMY_NO_KEY_COOKIE) === NO_KEY;
}
