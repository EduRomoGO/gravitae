import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { REDUCED_APP_ORIGIN } from "./ports";
import { crossBrowser } from "./tags";

// The orbit finder (/galeria/buscar): the seed simulated in the Web Worker,
// the orbit closed and shared by its URL, and Atomy operating it against the
// fake Gemini (e2e/fake-gemini.mts), which calls the finder's tools by a
// marker in the question.
const FINDER = "/galeria/buscar";
const NOTICE =
  "Modo reducido: sin modelo de lenguaje configurado. Atomy sigue guiando los experimentos sin IA.";
/** Closing integrates the orbit dozens of times; generous for slow CI. */
const CLOSING_MS = 30_000;

function finderStatus(page: Page) {
  return page
    .getByRole("region", { name: /Trayectoria|Órbita cerrada/ })
    .getByRole("status")
    .first();
}

test("the gallery links to the finder", async ({ page }) => {
  await page.goto("/galeria");
  await page.getByRole("link", { name: "busca tu propia órbita" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Busca tu propia órbita" }),
  ).toBeVisible();
});

test("the home links to the finder", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("main")
    .getByRole("link", { name: "Busca tu solución" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Busca tu propia órbita" }),
  ).toBeVisible();
});

test("Empezar moves the bodies along the trajectory", async ({ page }) => {
  await page.goto(FINDER);
  await expect(finderStatus(page)).toContainText("Mejor regreso");
  const body = page
    .getByRole("img", { name: /Trayectorias de los tres cuerpos/ })
    .locator("circle")
    .first();
  const before = await body.getAttribute("cx");

  await page.getByRole("button", { name: "Empezar" }).click();

  await expect(body).not.toHaveAttribute("cx", before ?? "");
  await expect(page.getByRole("button", { name: "Pausar" })).toBeEnabled();
});

test("Empezar brings the drawing into view on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(FINDER);
  await expect(finderStatus(page)).toContainText("Mejor regreso");
  const drawing = page.getByRole("img", {
    name: /Trayectorias de los tres cuerpos/,
  });
  await expect(drawing).not.toBeInViewport({ ratio: 1 });

  await page.getByRole("button", { name: "Empezar" }).click();

  await expect(drawing).toBeInViewport({ ratio: 1 });
});

test(
  "a seed is simulated, closed and shared by the URL",
  crossBrowser,
  async ({ page }) => {
    await page.goto(FINDER);
    await expect(finderStatus(page)).toContainText("Mejor regreso en t = 6,");
    await expect(
      page.getByRole("img", { name: /Trayectorias de los tres cuerpos/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Cerrar la órbita" }).click();

    await expect(finderStatus(page)).toHaveText(
      "Órbita cerrada: se repite cada 6,33 unidades de tiempo.",
      { timeout: CLOSING_MS },
    );
    await expect(page.getByText("Es la órbita Figura de ocho")).toBeVisible();
    await expect(page).toHaveURL(/\?vx=0\.347\d*&vy=0\.5327\d*&t=6\.3259/);

    await page.reload();
    await expect(finderStatus(page)).toHaveText(
      "Órbita cerrada: se repite cada 6,33 unidades de tiempo.",
      { timeout: CLOSING_MS },
    );
    await expect(page.getByText(/tras 0 correcciones/)).toBeVisible();
  },
);

test(
  "the seed's controls simulate the new seed",
  crossBrowser,
  async ({ page }) => {
    await page.goto(FINDER);
    await expect(finderStatus(page)).toContainText("Mejor regreso");

    await page.getByRole("spinbutton", { name: "Velocidad x (vx)" }).fill("0");
    await page.getByRole("spinbutton", { name: "Velocidad y (vy)" }).fill("0");

    await expect(finderStatus(page)).toHaveText(
      /^Dos cuerpos chocan con esta semilla en t = /,
    );
    await expect(
      page.getByRole("button", { name: "Cerrar la órbita" }),
    ).toBeDisabled();
  },
);

test("the finder has no accessibility violations", async ({ page }) => {
  await page.goto(FINDER);
  await expect(finderStatus(page)).toContainText("Mejor regreso");

  await expectNoAxeViolations(page);
});

test("Atomy starts from a catalogue orbit and closes it", async ({
  page,
}, testInfo) => {
  await page.goto(FINDER);
  await expect(finderStatus(page)).toContainText("Mejor regreso");
  await page
    .getByRole("button", { name: "Pregúntale a Atomy", exact: true })
    .click();
  const chat = page.getByRole("region", { name: "Chat con Atomy" });
  const ask = async (question: string) => {
    await page.getByRole("textbox", { name: "Tu pregunta" }).fill(question);
    await chat.getByRole("button", { name: "Enviar" }).click();
  };

  await ask(`Parte de Moth I [guion:buscador-partir] (${testInfo.testId})`);
  await expect(chat).toContainText(
    "Atomy partió de la semilla vx = 0,4644451728, vy = 0,3960600146.",
  );
  await expect(
    page.getByRole("spinbutton", { name: "Velocidad x (vx)" }),
  ).toHaveValue("0.4644451728");

  await ask(`Ciérrala [guion:buscador-cerrar] (${testInfo.testId})`);
  await expect(chat).toContainText(
    "Atomy cerró la órbita, con periodo 14,89: es Moth I.",
    { timeout: CLOSING_MS },
  );
  await expect(finderStatus(page)).toHaveText(
    "Órbita cerrada: se repite cada 14,89 unidades de tiempo.",
  );
});

test("the finder goes without Atomy once the reader turns the advanced mode off", async ({
  page,
}) => {
  await page.goto(FINDER);
  const dock = page.getByRole("button", {
    name: "Pregúntale a Atomy",
    exact: true,
  });
  await expect(dock).toBeVisible();

  await page.getByRole("switch", { name: "Modo reducido" }).click();

  await expect(dock).toHaveCount(0);
  await expect(finderStatus(page)).toContainText("Mejor regreso");
});

test.describe("without the language model", () => {
  test.use({ baseURL: REDUCED_APP_ORIGIN });

  test("the finder works with the reduced-mode notice and without Atomy", async ({
    page,
  }) => {
    await page.goto(FINDER);

    await expect(page.getByText(NOTICE)).toBeVisible();
    await expect(finderStatus(page)).toContainText("Mejor regreso");
    await expect(
      page.getByRole("button", { name: "Pregúntale a Atomy" }),
    ).toHaveCount(0);
  });
});
