import type { ReactElement } from "react";

/**
 * Rotates with a CSS `transform`, so it keeps moving while the main thread
 * calculates; it stays still when the system asks to reduce motion, and its
 * label still says what is happening.
 */
export function Spinner({ label }: { label: string }): ReactElement {
  return (
    <div className="flex h-full items-center justify-center">
      <div
        role="status"
        aria-label={label}
        className="size-10 motion-safe:animate-spin rounded-full border-4 border-slate-300 border-t-slate-700 dark:border-slate-700 dark:border-t-slate-200"
      />
    </div>
  );
}
