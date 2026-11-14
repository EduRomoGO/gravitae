import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { analyzeAxe } from "./axe";
import { skipPresentation, unrollLesson } from "./lesson";
import { pauseTheClock } from "./clock";
import { geminiRequests, type GeminiRequest } from "./gemini-requests";

// Atomy sets the widgets of the visible section, against the fake Gemini
// (e2e/fake-gemini.mts), which calls set_widget by a marker in the question
// and, once it gets the page's result, answers with PAGE_SCRIPT_ANSWER.
const PAGE_SCRIPT_ANSWER = "Mira lo que ha cambiado en la página.";
const WIDGET_LINE =
  "Atomy puso las bolitas e hilos en masa A ×4, masa B ×1 y distancia ×2.";

/** The whole lesson shown, `section` at the top of the viewport, the chat open. */
async function openChatAt(
  page: Page,
  baseURL: string | undefined,
  section: string,
) {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  await unrollLesson(page);
  await page.locator(`#${section}`).evaluate((element) => {
    element.scrollIntoView({ block: "start" });
  });
  await page
    .getByRole("button", { name: "Pregúntale a Atomy", exact: true })
    .click();
  return page.getByRole("region", { name: "Chat con Atomy" });
}

async function ask(page: Page, question: string) {
  await page.getByRole("textbox", { name: "Tu pregunta" }).fill(question);
  await page
    .getByRole("region", { name: "Chat con Atomy" })
    .getByRole("button", { name: "Enviar" })
    .click();
}

/** The fake Gemini's requests of this test's turn, in order. */
async function turnRequests(
  request: APIRequestContext,
  testId: string,
): Promise<GeminiRequest[]> {
  const all = await geminiRequests(request);
  return all.filter((body) => JSON.stringify(body).includes(testId));
}

function offeredTools(body: GeminiRequest | undefined): string[] {
  return (body?.tools ?? []).flatMap((tool) =>
    (tool.functionDeclarations ?? []).map(({ name }) => name),
  );
}

test("Atomy sets a widget of the visible section, says so, highlights it and announces it", async ({
  page,
  baseURL,
}, testInfo) => {
  const chat = await openChatAt(page, baseURL, "cualquiera");
  const section = page.locator("#cualquiera");

  await ask(page, `Cambia las bolitas [guion:widget] (${testInfo.testId})`);

  await expect(chat.getByRole("listitem").last()).toContainText(
    PAGE_SCRIPT_ANSWER,
  );
  await expect(section).toContainText("Fuerza: 4 × 1/4 = ×1");
  await expect(chat).toContainText(WIDGET_LINE);
  await expect(
    page.getByRole("status", { name: "Lo que hace Atomy" }),
  ).toHaveText(WIDGET_LINE);
  await expect(section.locator("[data-highlighted]")).toBeVisible();

  await section.getByRole("button", { name: "Más: Bolitas de B" }).click();
  await expect(section).toContainText("Fuerza: 8 × 1/4 = ×2");
});

/**
 * Moves the page's paused clock a frame at a time until `done` holds, so
 * timers due later, such as the highlight's HIGHLIGHT_MS, wait however slow
 * the machine is.
 */
async function runClockUntil(
  page: Page,
  done: () => boolean | Promise<boolean>,
) {
  const deadline = Date.now() + 15_000;
  while (!(await done())) {
    if (Date.now() > deadline) throw new Error("runClockUntil timed out");
    await page.clock.runFor(16);
  }
}

/** axe's contrast rule on `scope`, run while the page's clock is paused. */
async function contrastProblems(page: Page, scope: string) {
  let done = false;
  const analysis = analyzeAxe(page, (builder) =>
    builder.include(scope).withRules(["color-contrast"]),
  ).finally(() => {
    done = true;
  });
  await runClockUntil(page, () => done);
  const { violations, undecidedContrast } = await analysis;
  return [...violations, ...undecidedContrast];
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`a highlighted widget keeps its content's contrast, with the ${colorScheme} color scheme`, async ({
    page,
    baseURL,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    await page.clock.install();
    await openChatAt(page, baseURL, "cualquiera");
    const section = page.locator("#cualquiera");
    const highlighted = section.locator("[data-highlighted]");
    await pauseTheClock(page);

    await ask(page, `Cambia las bolitas [guion:widget] (${testInfo.testId})`);
    await runClockUntil(page, async () => (await highlighted.count()) > 0);
    // The pulse held at its midpoint, where the highlight fades the most.
    const pulses = await highlighted.evaluate((element) => {
      const animations = element.getAnimations();
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = 1000;
      }
      return animations.length;
    });
    expect(pulses).toBeGreaterThan(0);

    expect(
      await contrastProblems(page, "#cualquiera [data-highlighted]"),
    ).toEqual([]);
    await expect(highlighted).toHaveCount(1);
  });
}

test("each request carries the visible section's widgets and offers only them", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  const chat = await openChatAt(page, baseURL, "cualquiera");

  await ask(page, `Cambia las bolitas [guion:widget] (${testInfo.testId})`);
  await expect(chat.getByRole("listitem").last()).toContainText(
    PAGE_SCRIPT_ANSWER,
  );

  const [first, second] = await turnRequests(request, testInfo.testId);
  expect(JSON.stringify(first?.contents)).toContain(
    '{\\"massA\\":2,\\"massB\\":3,\\"distance\\":1}',
  );
  expect(JSON.stringify(second?.contents)).toContain(
    '{\\"massA\\":4,\\"massB\\":1,\\"distance\\":2}',
  );
  expect(offeredTools(first)).toContain("set_widget");
  const tools = JSON.stringify(first?.tools);
  expect(tools).toContain("hilos");
  // Widgets of sections the reader is not looking at are not offered.
  for (const other of ["dinamometro", "ascensor", "esfera", "astronautas"])
    expect(tools).not.toContain(other);
});

test("a value outside the widget's schema leaves it as it was and gives the model the error", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  const chat = await openChatAt(page, baseURL, "cualquiera");
  const section = page.locator("#cualquiera");

  await ask(page, `Aleja mucho B [guion:widget-fuera] (${testInfo.testId})`);

  await expect(chat.getByRole("listitem").last()).toContainText(
    PAGE_SCRIPT_ANSWER,
  );
  await expect(section).toContainText("Fuerza: 6 × 1 = ×6");
  await expect(chat).not.toContainText("Atomy puso");
  const requests = await turnRequests(request, testInfo.testId);
  const answered = requests.at(-1)?.contents.at(-1)?.parts ?? [];
  expect(
    answered.some((part) => part.functionResponse?.name === "set_widget"),
  ).toBe(true);
});
