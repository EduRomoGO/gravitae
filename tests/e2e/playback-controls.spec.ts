import { expect, test, type Page } from "@playwright/test";
import { crossBrowser } from "./tags";

const DETAIL = "/galeria/figura-de-ocho";

// components/gallery/orbit-player.test.tsx covers what each control does; these tests
// cover what needs the browser: its frame clock, the CSS of the marked speed and
// the player's state across a navigation.

function readout(page: Page) {
  return page.getByText(/^t = \d+,\d de 6,3 · vuelta \d+$/);
}

async function openDetail(page: Page) {
  await page.goto(DETAIL);
  await expect(page.locator('main svg[role="img"] circle')).toHaveCount(3);
}

/**
 * Opens the detail with `requestAnimationFrame` under the test's control, so
 * the simulation only advances by the time the test runs.
 */
async function openDetailWithPausedClock(page: Page) {
  await page.clock.install();
  await openDetail(page);
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
}

async function shownInstant(page: Page): Promise<number> {
  const text = await readout(page).textContent();
  return Number(text?.match(/^t = (\d+,\d)/)?.[1]?.replace(",", "."));
}

test(
  "pausing stops the simulation and resuming continues it",
  crossBrowser,
  async ({ page }) => {
    await openDetailWithPausedClock(page);
    await page.clock.runFor(1000);

    await page.getByRole("button", { name: "Pausar" }).click();
    await page.clock.runFor(100);
    const pausedAt = await shownInstant(page);
    const pausedX = await page
      .locator('main svg[role="img"] circle')
      .first()
      .getAttribute("cx");
    await page.clock.runFor(2000);

    expect(await shownInstant(page)).toBe(pausedAt);
    await expect(
      page.locator('main svg[role="img"] circle').first(),
    ).toHaveAttribute("cx", pausedX ?? "");

    await page.getByRole("button", { name: "Reproducir" }).click();
    await page.clock.runFor(1000);

    expect(await shownInstant(page)).toBeGreaterThan(pausedAt);
  },
);

test("the active speed is the one marked", crossBrowser, async ({ page }) => {
  await openDetail(page);
  const background = (name: string) =>
    page
      .getByRole("button", { name, exact: true })
      .evaluate((button) => getComputedStyle(button).backgroundColor);
  const marked = await background("1×");

  // The pointer stays on the button: the mark must also show while hovering.
  await page.getByRole("button", { name: "2×", exact: true }).click();

  await expect
    .poll(() => background("2×"), { message: "2× is marked" })
    .toBe(marked);
  expect(await background("1×")).not.toBe(marked);
  await expect(
    page.getByRole("button", { name: "2×", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "1×", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test(
  "the next solution starts playing even if the previous one was paused",
  crossBrowser,
  async ({ page }) => {
    await openDetail(page);
    await page.getByRole("button", { name: "Pausar" }).click();
    await page.getByRole("button", { name: "2×", exact: true }).click();
    await page.getByRole("checkbox", { name: "Estela" }).uncheck();

    await page
      .getByRole("navigation", { name: "Otras soluciones" })
      .getByRole("link", { name: "Solución: Butterfly I →", exact: true })
      .click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Butterfly I",
    );
    await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "1×", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("checkbox", { name: "Estela" })).toBeChecked();
  },
);
