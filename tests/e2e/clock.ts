import type { Page } from "@playwright/test";

/**
 * Stops the page's installed clock a while ahead of its current time, firing
 * the frames due on the way. `pauseAt` refuses an instant already past, and
 * under load more than a second of real time can go by between reading the
 * page's time and pausing it.
 */
export async function pauseTheClock(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 10_000);
}
