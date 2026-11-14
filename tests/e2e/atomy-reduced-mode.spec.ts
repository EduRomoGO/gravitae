import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { layoutShift, recordLayoutShifts } from "./layout-shift";
import { skipPresentation, unrollLesson } from "./lesson";
import { REDUCED_APP_ORIGIN } from "./ports";

// The reduced mode: the same build served without the Gemini key
// (playwright.config.ts), where Atomy guides the experiments without the
// language model.
const NOTICE =
  "Modo reducido: sin modelo de lenguaje configurado. Atomy sigue guiando los experimentos sin IA.";
const LESSON = "/ley-gravitacion-universal-newton";

test.use({ baseURL: REDUCED_APP_ORIGIN });

test.beforeEach(async ({ page, baseURL }) => {
  await skipPresentation(page, baseURL);
});

test("the lesson shows the reduced-mode band and the header's switch on and disabled, described by it", async ({
  page,
}) => {
  await page.goto(LESSON);

  await expect(page.getByText(NOTICE)).toBeVisible();
  const toggle = page.getByRole("switch", { name: "Modo reducido" });
  await expect(toggle).toBeDisabled();
  await expect(toggle).toBeChecked();
  await expect(toggle).toHaveAccessibleDescription(NOTICE);
  await expect(
    page.getByRole("button", { name: "Pregúntale a Atomy", exact: true }),
  ).toHaveCount(0);
});

// Most pages are built once, without the key: the proxy's cookie lets the
// page draw the band before its first paint, so it does not push the page
// down when the status answers.
for (const route of ["/galeria", "/galeria/figura-de-ocho", LESSON]) {
  test(`the band is in the first paint of ${route}, without shifting the page`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await recordLayoutShifts(page);

    const answered = page.waitForResponse("**/api/atomy/status");
    await page.goto(route);
    await answered;

    await expect(page.getByText(NOTICE)).toHaveCount(1);
    await expect(page.getByText(NOTICE)).toBeVisible();
    expect(await layoutShift(page)).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("the status's route handler answers no-key", async ({ request }) => {
  const response = await request.get("/api/atomy/status");

  expect(await response.json()).toEqual({ status: "no-key" });
});

test("the chat's route handler answers with the reduced mode", async ({
  request,
}) => {
  const response = await request.post("/api/atomy/chat", { data: {} });

  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ error: "reduced-mode" });
});

test("the correction's route handler answers with the reduced mode", async ({
  request,
}) => {
  const response = await request.post("/api/atomy/correction", { data: {} });

  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ error: "reduced-mode" });
});

test("a prediction does not ask for the reasoning and corrects the option by code", async ({
  page,
}) => {
  await page.goto(LESSON);
  const caida = page.locator("#caida");

  await caida.getByRole("button", { name: "Lo mismo", exact: true }).click();

  await expect(
    caida.getByRole("textbox", { name: "¿Por qué lo crees? (opcional)" }),
  ).toHaveCount(0);
  await caida.getByRole("button", { name: "Comprobar" }).click();
  await expect(caida.getByRole("status").last()).toContainText(
    "Has elegido «Lo mismo», pero la respuesta correcta es «Unas 2,5 veces menos».",
  );
});

test("the predictions are corrected by the code and the experiments work", async ({
  page,
}) => {
  await page.goto(LESSON);
  const caida = page.locator("#caida");
  await caida.getByRole("button", { name: "Lo mismo" }).click();
  await caida.getByRole("button", { name: "Comprobar" }).click();
  await expect(caida.getByRole("status")).toContainText(
    "Has elegido «Lo mismo», pero la respuesta correcta es «Unas 2,5 veces menos».",
  );

  // The lesson remembers its progress: it starts over without it. The lesson
  // is left first, since it keeps saving its progress while it is open.
  await page.goto("/galeria");
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto(LESSON);
  await unrollLesson(page);
  const threads = page.locator("#cualquiera");
  await expect(threads).toContainText("Fuerza: 6 × 1 = ×6");
  await threads.getByRole("button", { name: "Más: Bolitas de B" }).click();

  await expect(threads).toContainText("Fuerza: 8 × 1 = ×8");
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`the reduced mode has no axe violations with the ${colorScheme} color scheme`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(LESSON);
    await expect(page.getByText(NOTICE)).toBeVisible();

    await expectNoAxeViolations(page);
  });
}
