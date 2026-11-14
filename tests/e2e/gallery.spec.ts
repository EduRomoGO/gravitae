import { expect, test, type Page } from "@playwright/test";
import {
  BODIES_IN_THE_GALLERY,
  bodies,
  cards,
  cardsThatMoved,
} from "./gallery-cards";
import { crossBrowser } from "./tags";

const LINK_NAME = "Explora órbitas de tres cuerpos";

const CARDS = [
  { slug: "lagrange", name: "Lagrange", lap: "Una vuelta: 8,27" },
  { slug: "figura-de-ocho", name: "Figura de ocho", lap: "Una vuelta: 6,33" },
  { slug: "butterfly-i", name: "Butterfly I", lap: "Una vuelta: 6,23" },
  { slug: "goggles", name: "Goggles", lap: "Una vuelta: 10,46" },
  { slug: "moth-i", name: "Moth I", lap: "Una vuelta: 14,89" },
  { slug: "yin-yang-i", name: "Yin-Yang I", lap: "Una vuelta: 10,96" },
];

async function expectTheSixCards(page: Page) {
  await expect(cards(page)).toHaveCount(CARDS.length);
  for (const [index, { slug, name, lap }] of CARDS.entries()) {
    const card = cards(page).nth(index);
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(name);
    await expect(card).toContainText(lap);
    await expect(card.getByRole("link")).toHaveAttribute(
      "href",
      `/galeria/${slug}`,
    );
  }
}

test(
  "the gallery shows the six cards, all of them animating",
  crossBrowser,
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 2000 });
    await page.goto("/galeria");

    await expectTheSixCards(page);
    await expect(bodies(page)).toHaveCount(BODIES_IN_THE_GALLERY);
    await expect
      .poll(() => cardsThatMoved(page))
      .toEqual(CARDS.map(() => true));
  },
);

test("a card links to the detail of its solution", async ({ page }) => {
  await page.goto("/galeria");

  await cards(page).nth(1).getByRole("link").click();

  await expect(page).toHaveURL("/galeria/figura-de-ocho");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Figura de ocho",
  );
});

// The browser drops a click whose press landed on a node that left the page
// before the release; the spinner leaves it when the orbit replaces it.
test("a press on a card's spinner follows the link after the orbit replaces it", async ({
  page,
}) => {
  // Holds the orbit animation's chunk, so the card shows its spinner until
  // the press has started.
  let releaseOrbitChunk = () => {};
  const orbitChunkReleased = new Promise<void>((resolve) => {
    releaseOrbitChunk = resolve;
  });
  await page.route("**/_next/static/chunks/*.js", async (route) => {
    const response = await route.fetch();
    if ((await response.text()).includes('path[data-part="trail"]')) {
      await orbitChunkReleased;
    }
    await route.fulfill({ response });
  });
  await page.goto("/galeria");
  // The pause button answers once the page is hydrated.
  await expect(async () => {
    await page.getByRole("button", { name: "Pausar animaciones" }).click();
    await expect(
      page.getByRole("button", { name: "Reproducir animaciones" }),
    ).toBeVisible({ timeout: 100 });
  }).toPass();

  const card = cards(page).nth(1);
  const spinner = card.getByRole("status", { name: "Calculando la órbita" });
  // The gallery's introduction fills the first screen.
  await card.evaluate((element) => {
    element.scrollIntoView({ block: "start" });
  });
  const box = await spinner.boundingBox();
  if (!box) throw new Error("the card's spinner is not on screen");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  releaseOrbitChunk();
  await expect(card.locator("svg circle")).toHaveCount(3);
  await page.mouse.up();

  await expect(page).toHaveURL("/galeria/figura-de-ocho");
});

test.describe("before the browser runs any JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the server HTML has each card's name, lap and link, and a spinner in place of its orbit", async ({
    page,
  }) => {
    await page.goto("/galeria");

    await expectTheSixCards(page);
    await expect(
      page.getByRole("status", { name: "Calculando la órbita" }),
    ).toHaveCount(CARDS.length);
    await expect(cards(page).locator("svg")).toHaveCount(0);
  });
});

// The breakpoints are checked in one test because each width only needs a reload.
test("the gallery has 3 columns on desktop, 2 on tablet and 1 on mobile", async ({
  page,
}) => {
  for (const { width, columns } of [
    { width: 1280, columns: 3 },
    { width: 800, columns: 2 },
    { width: 390, columns: 1 },
  ]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/galeria");

    const lefts = await cards(page).evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().left),
    );
    expect(new Set(lefts).size, `columns at ${String(width)}px`).toBe(columns);
  }
});

test("a phone has no horizontal scroll", crossBrowser, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/galeria");
  await expect(bodies(page)).toHaveCount(BODIES_IN_THE_GALLERY);

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test(
  "a card is as tall with the spinner as with the orbit",
  crossBrowser,
  async ({ page }) => {
    const cardHeight = () =>
      cards(page)
        .first()
        .evaluate((card) => card.getBoundingClientRect().height);

    // With its scripts blocked the page stays as the server sent it.
    await page.route("**/*.js", (route) => route.abort());
    await page.goto("/galeria");
    await expect(
      page.getByRole("status", { name: "Calculando la órbita" }),
    ).toHaveCount(CARDS.length);
    const heightWithSpinner = await cardHeight();

    await page.unroute("**/*.js");
    await page.goto("/galeria");
    await expect(bodies(page)).toHaveCount(BODIES_IN_THE_GALLERY);

    expect(await cardHeight()).toBeCloseTo(heightWithSpinner, 1);
  },
);

test(
  "the cards off screen stop their animation until they are scrolled to",
  crossBrowser,
  async ({ page }) => {
    // Short enough to show the first row of three cards and leave out the second.
    await page.setViewportSize({ width: 1280, height: 300 });
    await page.goto("/galeria");
    await expect(bodies(page)).toHaveCount(BODIES_IN_THE_GALLERY);
    // The gallery's introduction fills the first screen.
    await cards(page)
      .first()
      .evaluate((card) => {
        card.scrollIntoView({ block: "start" });
      });

    await expect
      .poll(() => cardsThatMoved(page))
      .toEqual([true, true, true, false, false, false]);

    await cards(page).last().scrollIntoViewIfNeeded();

    await expect
      .poll(() => cardsThatMoved(page))
      .toEqual([false, false, false, true, true, true]);
  },
);

test("the home page links to the gallery", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("main")
    .getByRole("link", { name: LINK_NAME, exact: true })
    .click();

  await expect(page).toHaveURL("/galeria");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
