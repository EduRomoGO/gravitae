// Tells every page whether the server has the language model's key, through
// a cookie its first paint can read (components/atomy/atomy-cookie.ts). The
// pages built once cannot read the key per request themselves, and the key
// may come after the build (the Docker image, the e2e server without it).

import { NextResponse, type NextRequest } from "next/server";
import { ATOMY_NO_KEY_COOKIE, NO_KEY } from "@/components/atomy/atomy-cookie";
import { languageModelConfigured } from "@/lib/atomy/gemini";

export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const said = request.cookies.get(ATOMY_NO_KEY_COOKIE)?.value === NO_KEY;
  if (languageModelConfigured()) {
    if (said) response.cookies.delete(ATOMY_NO_KEY_COOKIE);
  } else if (!said) {
    response.cookies.set(ATOMY_NO_KEY_COOKIE, NO_KEY, {
      path: "/",
      sameSite: "lax",
    });
  }
  return response;
}

export const config = {
  // The pages only: not the route handlers, the build's files or the public
  // folder's.
  matcher: ["/((?!api/|_next/|.*\\.[^/]+$).*)"],
};
