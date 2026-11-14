import { expect, test } from "@playwright/test";

// Each page has its own title (WCAG 2.4.2), so tabs, history and shared links
// tell the pages apart.
test("the home's title names its content", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(
    "La gravitación y los tres cuerpos · Gravitae",
  );
});

test("the gallery's title names the gallery", async ({ page }) => {
  await page.goto("/galeria");

  await expect(page).toHaveTitle("Galería de los tres cuerpos · Gravitae");
});

test("the lesson's title names the lesson", async ({ page }) => {
  await page.goto("/ley-gravitacion-universal-newton");

  await expect(page).toHaveTitle(
    "Aprende la ley de la gravitación universal de Newton · Gravitae",
  );
});

test("a detail's title names its solution and its meta description describes it", async ({
  page,
}) => {
  await page.goto("/galeria/figura-de-ocho");

  await expect(page).toHaveTitle("Figura de ocho · Gravitae");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Los tres cuerpos recorren, uno tras otro, una misma curva con forma de 8.",
  );
});

test("the 404 page's title tells that the page does not exist", async ({
  page,
}) => {
  for (const url of ["/no-existe", "/galeria/no-existe"]) {
    await page.goto(url);

    await expect(page).toHaveTitle("Página no encontrada · Gravitae");
  }
});
