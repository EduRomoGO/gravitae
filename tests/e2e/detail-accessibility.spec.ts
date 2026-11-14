import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { SOLUTIONS } from "../../src/lib/orbits/solutions";
import { crossBrowser } from "./tags";

const DETAIL = "/galeria/figura-de-ocho";

function readout(page: Page) {
  return page.getByText(/^t = \d+,\d de 6,3 · vuelta \d+$/);
}

async function openDetail(page: Page, path = DETAIL) {
  await page.goto(path);
  await expect(page.locator("main svg[viewBox] circle")).toHaveCount(3);
}

/** The player's announcements; the spinner, also a `status`, is gone by then. */
function announcements(page: Page) {
  return page.getByRole("main").getByRole("status");
}

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test(
    "the detail loads paused at the initial instant with the full orbit drawn",
    crossBrowser,
    async ({ page }) => {
      await page.clock.install();
      await openDetail(page);
      await page.clock.runFor(2000);

      await expect(
        page.getByRole("button", { name: "Reproducir" }),
      ).toBeVisible();
      await expect(readout(page)).toHaveText("t = 0,0 de 6,3 · vuelta 1");
      await expect(page.locator('main path[data-part="path"]')).toHaveCount(3);
      for (const orbit of await page
        .locator('main path[data-part="path"]')
        .all()) {
        await expect(orbit).toBeVisible();
      }
      await expect(announcements(page)).toHaveText("");
    },
  );

  test("pressing play starts the simulation", async ({ page }) => {
    await openDetail(page);

    await page.getByRole("button", { name: "Reproducir" }).click();

    await expect(readout(page)).not.toHaveText("t = 0,0 de 6,3 · vuelta 1");
    await expect(announcements(page)).toHaveText("Reproduciendo");
  });
});

test("pausing, playing and restarting are announced", async ({ page }) => {
  await openDetail(page);
  await expect(announcements(page)).toHaveText("");

  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(announcements(page)).toHaveText("En pausa");

  await page.getByRole("button", { name: "Reproducir" }).click();
  await expect(announcements(page)).toHaveText("Reproduciendo");

  await page.getByRole("button", { name: "Reiniciar" }).click();
  await expect(announcements(page)).toHaveText("Reiniciado");

  // The announcement is visually hidden, and the lap readout stays out of it.
  await expect(announcements(page)).not.toBeInViewport();
  expect(
    await readout(page).evaluate((node) =>
      Boolean(node.closest("[aria-live], [role=status]")),
    ),
  ).toBe(false);

  await expectNoAxeViolations(page);
});

test("each solution's drawing is an image named after its shape", async ({
  page,
}) => {
  const names = new Set<string>();
  for (const { slug, shape } of SOLUTIONS) {
    await openDetail(page, `/galeria/${slug}`);

    const drawing = page.getByRole("img", { name: shape, exact: true });
    await expect(drawing).toBeVisible();
    await expect(drawing.locator("title, desc")).toHaveCount(0);
    names.add(shape);
  }
  expect(names.size).toBe(SOLUTIONS.length);
});
