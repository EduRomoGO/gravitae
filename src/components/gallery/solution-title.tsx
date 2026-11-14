"use client";

import { useEffect, useRef, type ReactElement } from "react";

/** The detail's heading, which takes the focus when the detail is entered. */
export function SolutionTitle({ name }: { name: string }): ReactElement {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <h1
      ref={heading}
      tabIndex={-1}
      // Focused by the code, not by the reader: no ring, which Chromium
      // draws on entering by the URL. It is no control (tabIndex -1).
      className="mt-3 text-2xl font-semibold focus:outline-none sm:text-3xl"
    >
      {name}
    </h1>
  );
}
