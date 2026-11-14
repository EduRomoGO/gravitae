// What the server knows of the app's mode (components/shared/atomy-mode.tsx)
// when it renders a page: whether it has the language model's key and the
// reader's choice, kept in a cookie. Server code only: a page that offers
// the advanced mode reads it per request and hands it, whole, to its client
// component, which seeds the provider with it.

import { cookies } from "next/headers";
import {
  ATOMY_MODE_COOKIE,
  choiceOfCookie,
  type AtomyModeChoice,
} from "@/components/atomy/atomy-cookie";
import { languageModelConfigured } from "@/lib/atomy/gemini";

export interface ServerMode {
  /** The server has the language model's key. */
  readonly modelConfigured: boolean;
  /** The reader's choice of mode, by the cookie. */
  readonly choice: AtomyModeChoice;
}

/**
 * Reads the mode per request, not when the page is built: the reader's
 * choice is a cookie, and the deployment may set the key after the build.
 */
export async function readServerMode(): Promise<ServerMode> {
  const value = (await cookies()).get(ATOMY_MODE_COOKIE)?.value;
  return {
    modelConfigured: languageModelConfigured(),
    choice: choiceOfCookie(value),
  };
}
