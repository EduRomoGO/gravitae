"use client";

// A script that runs while the browser parses the server's HTML, before the
// first paint. Rendered on the client (a navigation within the app), it is
// inert text: React does not run scripts it renders, and warns about them
// unless they are of another type.

import type { ReactElement } from "react";

export function InlineScript({ code }: { code: string }): ReactElement {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
