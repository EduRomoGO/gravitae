import { expect, test, type Page } from "@playwright/test";
import { pauseTheClock } from "./clock";
import { crossBrowser } from "./tags";

const GALLERY_HEADING = "Galería de los tres cuerpos";
const BODIES_IN_THE_GALLERY = 18;
/** A card of the second row, so that reaching it needs some scroll. */
const ORIGIN_CARD = 4;
const ORIGIN_NAME = "Moth I";

function originCard(page: Page) {
  return page.locator("main ul > li").nth(ORIGIN_CARD);
}

function originBody(page: Page) {
  return originCard(page).locator("svg circle").first();
}

function mainHeading(page: Page) {
  return page.getByRole("heading", { level: 1 });
}

function scrollY(page: Page) {
  return page.evaluate(() => window.scrollY);
}

/**
 * Opens the detail from a scrolled gallery whose animation has moved and then
 * stopped: `page.clock` freezes requestAnimationFrame, so a body keeps the
 * coordinates read here unless the gallery loses them.
 */
async function leaveTheGalleryFromACard(page: Page) {
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.clock.install();
  await page.goto("/galeria");
  await expect(page.locator("main ul > li svg circle")).toHaveCount(
    BODIES_IN_THE_GALLERY,
  );
  await originCard(page).scrollIntoViewIfNeeded();

  const startX = await originBody(page).getAttribute("cx");
  await expect.poll(() => originBody(page).getAttribute("cx")).not.toBe(startX);
  await pauseTheClock(page);

  const left = {
    scrollY: await scrollY(page),
    bodyX: await originBody(page).getAttribute("cx"),
    bodyY: await originBody(page).getAttribute("cy"),
  };
  expect(left.scrollY).toBeGreaterThan(0);

  await originCard(page).getByRole("link").click();
  await expect(mainHeading(page)).toHaveText(ORIGIN_NAME);
  return left;
}

async function expectTheGalleryAsItWasLeft(
  page: Page,
  left: Awaited<ReturnType<typeof leaveTheGalleryFromACard>>,
) {
  await expect(mainHeading(page)).toHaveText(GALLERY_HEADING);
  await expect(originCard(page).getByRole("link")).toBeFocused();
  expect(await scrollY(page)).toBeCloseTo(left.scrollY, 0);
  await expect(originBody(page)).toHaveAttribute("cx", left.bodyX ?? "");
  await expect(originBody(page)).toHaveAttribute("cy", left.bodyY ?? "");
}

function backLink(page: Page) {
  return page.getByRole("main").getByRole("link", { name: "← Galería" });
}

test(
  "the «← Galería» link returns to the gallery as it was left",
  crossBrowser,
  async ({ page }) => {
    const left = await leaveTheGalleryFromACard(page);

    await backLink(page).click();

    await expectTheGalleryAsItWasLeft(page, left);
  },
);

test(
  "the header link returns to the gallery as it was left",
  crossBrowser,
  async ({ page }) => {
    const left = await leaveTheGalleryFromACard(page);

    await page
      .getByRole("banner")
      .getByRole("link", { name: "Órbitas de tres cuerpos" })
      .click();

    await expectTheGalleryAsItWasLeft(page, left);
  },
);

test(
  "Back returns to the gallery as it was left",
  crossBrowser,
  async ({ page }) => {
    const left = await leaveTheGalleryFromACard(page);

    await page.goBack();

    await expectTheGalleryAsItWasLeft(page, left);
  },
);

test(
  "Back after Forward returns to the gallery as it was left",
  crossBrowser,
  async ({ page }) => {
    const left = await leaveTheGalleryFromACard(page);

    await page.goBack();
    await expect(mainHeading(page)).toHaveText(GALLERY_HEADING);
    await page.goForward();
    await expect(mainHeading(page)).toHaveText(ORIGIN_NAME);
    await page.goBack();

    await expectTheGalleryAsItWasLeft(page, left);
  },
);

test(
  "after walking through three solutions the gallery is as it was left, focused on the card of origin",
  crossBrowser,
  async ({ page }) => {
    const left = await leaveTheGalleryFromACard(page);
    const nextLink = page
      .getByRole("navigation", { name: "Otras soluciones" })
      .getByRole("link")
      .last();

    for (const name of ["Yin-Yang I", "Lagrange", "Figura de ocho"]) {
      await nextLink.click();
      await expect(mainHeading(page)).toHaveText(name);
    }
    await backLink(page).click();

    await expectTheGalleryAsItWasLeft(page, left);
  },
);

test(
  "with nothing saved the gallery stays at the top and no card takes the focus",
  crossBrowser,
  async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 300 });
    await page.goto("/galeria/goggles");
    // Small enough to keep the link on screen: Playwright would scroll to it.
    await page.evaluate(() => {
      window.scrollTo(0, 10);
    });
    await expect.poll(() => scrollY(page)).toBe(10);

    await backLink(page).click();

    await expect(mainHeading(page)).toHaveText(GALLERY_HEADING);
    expect(await scrollY(page)).toBe(0);
    await expect(page.locator("main ul > li a:focus")).toHaveCount(0);
  },
);
