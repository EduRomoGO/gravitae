import { expect, test, type Page } from "@playwright/test";
import {
  BODIES_IN_THE_GALLERY,
  bodies,
  cards,
  cardsThatMoved,
} from "./gallery-cards";
import { pauseTheClock } from "./clock";
import { crossBrowser } from "./tags";

const ALL_MOVING = [true, true, true, true, true, true];
const ALL_STILL = [false, false, false, false, false, false];

function pauseButton(page: Page) {
  return page.getByRole("button", { name: "Pausar animaciones" });
}

function playButton(page: Page) {
  return page.getByRole("button", { name: "Reproducir animaciones" });
}

/** The gallery's announcement; the spinners are statuses too, with a name. */
function announcement(page: Page) {
  return page.getByRole("main").getByRole("status").filter({
    hasNotText: /^$/,
  });
}

function bodyPositions(page: Page) {
  return cards(page).evaluateAll((items) =>
    items.map((item) => {
      const body = item.querySelector("svg circle");
      return `${body?.getAttribute("cx") ?? ""},${body?.getAttribute("cy") ?? ""}`;
    }),
  );
}

/** A gallery tall enough to have its six cards on screen, all animating. */
async function openTheGallery(page: Page) {
  await page.setViewportSize({ width: 1280, height: 2000 });
  await page.goto("/galeria");
  await expect(bodies(page)).toHaveCount(BODIES_IN_THE_GALLERY);
}

test(
  "the pause button freezes every card at its instant and plays them on from there",
  crossBrowser,
  async ({ page }) => {
    await page.clock.install();
    await openTheGallery(page);
    await expect.poll(() => cardsThatMoved(page)).toEqual(ALL_MOVING);

    await pauseButton(page).click();

    await expect(announcement(page)).toHaveText("En pausa");
    await expect.poll(() => cardsThatMoved(page)).toEqual(ALL_STILL);

    // With the clock stopped no frame runs, so the frame that resumes the
    // cards is the one `runFor` triggers.
    await pauseTheClock(page);
    const frozen = await bodyPositions(page);
    await playButton(page).click();
    await expect(announcement(page)).toHaveText("Reproduciendo");
    // Frames come every 16 ms: this runs exactly one, and the first frame
    // after playing again only starts counting the time.
    await page.clock.runFor(16);
    expect(await bodyPositions(page)).toEqual(frozen);

    await page.clock.runFor(500);
    const resumed = await bodyPositions(page);
    resumed.forEach((position, index) => {
      expect(position, `card ${String(index)}`).not.toBe(frozen[index]);
    });
  },
);

test("the pause outlasts a visit to a detail", async ({ page }) => {
  await openTheGallery(page);
  await pauseButton(page).click();

  await cards(page).first().getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lagrange");
  await page.getByRole("main").getByRole("link", { name: "← Galería" }).click();

  await expect(playButton(page)).toBeVisible();
  await expect(bodies(page)).toHaveCount(BODIES_IN_THE_GALLERY);
  await expect.poll(() => cardsThatMoved(page)).toEqual(ALL_STILL);
});

test(
  "the keyboard focus on a card resumes its animation as the pointer does",
  crossBrowser,
  async ({ page }) => {
    // WebKit takes 11 to 18 s to run the 30 s of frames below on an idle
    // machine, close to the default timeout when other tests run beside it.
    test.slow();
    await page.clock.install();
    await openTheGallery(page);
    // A card plays only once its IntersectionObserver reports it on screen,
    // which WebKit may do after the 18 bodies are drawn and even after the
    // clock is paused. A card that started that late would still be moving
    // below, so every card is seen moving before the clock stops.
    await expect.poll(() => cardsThatMoved(page)).toEqual(ALL_MOVING);
    await pauseTheClock(page);
    // Past the laps every card plays before it stops.
    await page.clock.runFor(30_000);
    const stopped = await bodyPositions(page);
    await page.clock.runFor(1000);
    expect(await bodyPositions(page)).toEqual(stopped);
    const link = cards(page).nth(1).getByRole("link");

    await link.focus();
    await page.clock.runFor(1000);
    const focused = await bodyPositions(page);
    await link.blur();
    await page.clock.runFor(1000);

    expect(focused[1]).not.toBe(stopped[1]);
    expect(focused[0]).toBe(stopped[0]);
    expect((await bodyPositions(page))[1]).toBe(focused[1]);
  },
);

test.describe("when the system asks to reduce motion", () => {
  test.use({ reducedMotion: "reduce" });

  test(
    "the gallery loads paused, with every orbit drawn, until the reader plays it",
    crossBrowser,
    async ({ page }) => {
      await openTheGallery(page);

      await expect(playButton(page)).toBeVisible();
      await expect(
        page.locator('main ul > li svg path[data-part="path"]'),
      ).toHaveCount(BODIES_IN_THE_GALLERY);
      for (const orbit of await page
        .locator('main ul > li svg path[data-part="path"]')
        .all()) {
        await expect(orbit).toBeVisible();
      }
      await expect(announcement(page)).toHaveCount(0);
      expect(await cardsThatMoved(page)).toEqual(ALL_STILL);

      await playButton(page).click();

      await expect.poll(() => cardsThatMoved(page)).toEqual(ALL_MOVING);
      await page.reload();
      await expect(bodies(page)).toHaveCount(BODIES_IN_THE_GALLERY);
      await expect(playButton(page)).toBeVisible();
      expect(await cardsThatMoved(page)).toEqual(ALL_STILL);
    },
  );

  test("the spinner stands still and keeps its label", async ({ page }) => {
    // With its scripts blocked the page stays as the server sent it.
    await page.route("**/*.js", (route) => route.abort());
    await page.goto("/galeria");
    const spinner = page
      .getByRole("status", { name: "Calculando la órbita" })
      .first();

    await expect(spinner).toBeVisible();
    expect(
      await spinner.evaluate((node) => getComputedStyle(node).animationName),
    ).toBe("none");
  });
});

test("the spinner turns when motion is not reduced", async ({ page }) => {
  await page.route("**/*.js", (route) => route.abort());
  await page.goto("/galeria");
  const spinner = page
    .getByRole("status", { name: "Calculando la órbita" })
    .first();

  await expect(spinner).toBeVisible();
  expect(
    await spinner.evaluate((node) => getComputedStyle(node).animationName),
  ).not.toBe("none");
});
