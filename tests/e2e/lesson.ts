import { expect, type Locator, type Page } from "@playwright/test";

// Helpers for the gravitation law lesson at /ley-gravitacion-universal-newton, which opens with Atomy's
// presentation and then shows one step at a time.

export const LESSON_TITLE = "¿Por qué en la Luna todo cae a cámara lenta?";

/** Marks Atomy as already met, so the lesson page opens on the lesson. */
export async function skipPresentation(
  page: Page,
  baseURL: string | undefined,
): Promise<void> {
  await page.context().addCookies([
    {
      name: "atomy-intro",
      value: "seen",
      url: baseURL ?? "http://localhost",
    },
  ]);
}

/**
 * Turns the advanced mode off, as the header's switch does: the app opens in
 * the reduced mode. Without it the app opens in the advanced mode, the default.
 */
export async function chooseReducedMode(
  page: Page,
  baseURL: string | undefined,
): Promise<void> {
  await page.context().addCookies([
    {
      name: "atomy-modo",
      value: "reduced",
      url: baseURL ?? "http://localhost",
    },
  ]);
}

/**
 * Checks the answer picked in `step`; in the advanced mode, opening the
 * experiment first, since it waits for the reader there.
 */
export async function checkPrediction(step: Locator): Promise<void> {
  const open = step.getByRole("button", { name: "Hacer el experimento" });
  const check = step.getByRole("button", { name: "Comprobar" });
  await expect(open.or(check)).toBeVisible();
  if (await open.isVisible()) await open.click();
  await check.click();
}

async function predict(page: Page, section: string, option: string) {
  const step = page.locator(`#${section}`);
  await step.getByRole("button", { name: option, exact: true }).click();
  await checkPrediction(step);
  await expect(step.getByRole("status").last()).toBeVisible();
}

/** Resolves the experiments before the distance's, so it is shown. */
export async function unrollUntilDistance(page: Page): Promise<void> {
  await predict(page, "caida", "Unas 2,5 veces menos");
  await predict(page, "tiron", "Su peso");
  for (const name of ["Saturno", "Tierra", "Urano"]) {
    await page
      .locator("#planeta")
      .getByRole("button")
      .filter({ has: page.getByText(name, { exact: true }) })
      .click();
  }
  await page
    .locator("#planeta")
    .getByRole("button", { name: "Comprobar" })
    .click();
  await expect(page.locator("#distancia")).toBeVisible();
}

/** Resolves every experiment in order, so the whole lesson is shown. */
export async function unrollLesson(page: Page): Promise<void> {
  await unrollUntilDistance(page);
  await predict(page, "distancia", "2,45 N, la cuarta parte");
  await predict(
    page,
    "distancia",
    "Porque se reparte hacia arriba y hacia los lados a la vez",
  );
  await predict(page, "cualquiera", "×4");
  await predict(page, "iguales", "Los dos la misma");
  await predict(page, "mesa", "Se juntan, pero tardan horas");
  await expect(page.locator("#tres")).toBeVisible();
}
