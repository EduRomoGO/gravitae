import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { MAX_AUTOMATIC_RESENDS } from "../../src/lib/atomy/client-tools";
import { skipPresentation, unrollLesson } from "./lesson";
import { geminiRequests, type GeminiRequest } from "./gemini-requests";

// Atomy operates the lesson with the tools of the page, against the fake
// Gemini (e2e/fake-gemini.mts), which calls them by a marker in the question
// and, once it gets the page's result, answers with PAGE_SCRIPT_ANSWER.
const PAGE_SCRIPT_ANSWER = "Mira lo que ha cambiado en la página.";

/** The whole lesson shown, with the chat open. */
async function openChatOnLesson(page: Page, baseURL: string | undefined) {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  await unrollLesson(page);
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

test("go_to_section takes the reader to the section, with focus on its title", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  const chat = await openChatOnLesson(page, baseURL);
  const title = page.getByRole("heading", {
    name: "Empecemos soltando tres cajas idénticas",
  });
  await expect(title).not.toBeInViewport();

  await ask(page, `Llévame al principio [guion:seccion] (${testInfo.testId})`);

  await expect(title).toBeFocused();
  await expect(title).toBeInViewport();
  await expect(chat).toContainText(
    "Atomy te llevó a la sección «Empecemos soltando tres cajas idénticas».",
  );
  const [first] = await turnRequests(request, testInfo.testId);
  const tools = JSON.stringify(first?.tools);
  expect(tools).toContain("go_to_section");
  expect(tools).not.toContain("set_explorer");
  expect(tools).not.toContain("pose_challenge");
  await expect(chat.getByRole("listitem").last()).toContainText(
    PAGE_SCRIPT_ANSWER,
  );
});

test("the chat stops resending by itself after a fixed number of rounds of tools", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  await openChatOnLesson(page, baseURL);

  await ask(page, `Ponlo una y otra vez [guion:bucle] (${testInfo.testId})`);

  await expect(page.locator("#atomy-dock svg")).toHaveAttribute(
    "data-state",
    "idle",
  );
  await expect
    .poll(async () => (await turnRequests(request, testInfo.testId)).length)
    .toBe(1 + MAX_AUTOMATIC_RESENDS);
  await page.waitForTimeout(500);
  expect(await turnRequests(request, testInfo.testId)).toHaveLength(
    1 + MAX_AUTOMATIC_RESENDS,
  );
});

test.describe("the highlight", () => {
  /** Atomy sets the beads and threads of «cualquiera», which it highlights. */
  async function highlightWidget(
    page: Page,
    baseURL: string | undefined,
    testId: string,
  ) {
    await skipPresentation(page, baseURL);
    await page.goto("/ley-gravitacion-universal-newton");
    await unrollLesson(page);
    await page.locator("#cualquiera").evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });
    await page
      .getByRole("button", { name: "Pregúntale a Atomy", exact: true })
      .click();
    await ask(page, `Cambia las bolitas [guion:widget] (${testId})`);
    const highlighted = page
      .locator("#cualquiera")
      .locator("[data-highlighted]");
    await expect(highlighted).toBeVisible();
    return highlighted;
  }

  test("pulses while motion is allowed", async ({
    page,
    baseURL,
  }, testInfo) => {
    const highlighted = await highlightWidget(page, baseURL, testInfo.testId);

    expect(
      await highlighted.evaluate((element) => element.getAnimations().length),
    ).toBeGreaterThan(0);
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("stays still", async ({ page, baseURL }, testInfo) => {
      const highlighted = await highlightWidget(page, baseURL, testInfo.testId);

      expect(
        await highlighted.evaluate((element) => element.getAnimations().length),
      ).toBe(0);
    });
  });
});
