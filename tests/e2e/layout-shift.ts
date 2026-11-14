import type { Page } from "@playwright/test";

// The layout shift of the page since it started loading, as the CLS of the
// Web Vitals adds it up: the sum of every shift the reader did not cause.

/** Starts recording the page's shifts; call it before the page loads. */
export async function recordLayoutShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shifts: number[] = [];
    Object.assign(window, { __layoutShifts: shifts });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (
          "value" in entry &&
          typeof entry.value === "number" &&
          !("hadRecentInput" in entry && entry.hadRecentInput === true)
        ) {
          shifts.push(entry.value);
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

/** The shifts recorded since the page loaded, added up. */
export async function layoutShift(page: Page): Promise<number> {
  // The observer hears of a shift in a later task than the shift itself.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => setTimeout(resolve, 0));
      }),
  );
  return page.evaluate(() => {
    const shifts: unknown = Reflect.get(window, "__layoutShifts");
    return Array.isArray(shifts)
      ? shifts.reduce((sum: number, value: unknown) =>
          typeof value === "number" ? sum + value : sum,
        0)
      : Number.NaN;
  });
}
