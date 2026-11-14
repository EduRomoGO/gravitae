import { vi } from "vitest";

/**
 * Makes every element measure `width` CSS pixels wide, as a drawing does on
 * a phone; jsdom lays nothing out and measures 0. Restore with
 * `vi.restoreAllMocks()`.
 */
export function renderAtWidth(width: number): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ width, height: 0 }),
  );
}
