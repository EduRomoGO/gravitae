import { expect, test } from "@playwright/test";
import { layoutShift, recordLayoutShifts } from "./layout-shift";
import { chooseReducedMode } from "./lesson";

const SECTIONS = [
  "La ley de la gravitación",
  "Órbitas de tres cuerpos",
  "Busca tu solución",
];

test("the header's finder link leads to the finder and marks only it", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Principal" });

  await nav.getByRole("link", { name: "Busca tu solución" }).click();

  await expect(page).toHaveURL("/galeria/buscar");
  await expect(
    nav.getByRole("link", { name: "Busca tu solución" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.getByRole("link", { name: "Órbitas de tres cuerpos" }),
  ).not.toHaveAttribute("aria-current");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test("the sections live in a side menu behind a button", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Principal" });
    for (const name of SECTIONS) {
      await expect(nav.getByRole("link", { name })).toBeHidden();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const button = nav.getByRole("button", { name: "Menú", exact: true });
    await button.click();

    const menu = page.getByRole("dialog", { name: "Menú" });
    await expect(button).toHaveAttribute("aria-expanded", "true");
    for (const name of SECTIONS) {
      await expect(menu.getByRole("link", { name })).toBeVisible();
    }

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("a link of the menu navigates and closes it", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("button", { name: "Menú", exact: true })
      .click();
    const menu = page.getByRole("dialog", { name: "Menú" });

    await menu.getByRole("link", { name: "Busca tu solución" }).click();

    await expect(page).toHaveURL("/galeria/buscar");
    await expect(menu).toBeHidden();
  });

  test("the close button and the backdrop close the menu", async ({ page }) => {
    await page.goto("/");
    const button = page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("button", { name: "Menú", exact: true });
    const menu = page.getByRole("dialog", { name: "Menú" });

    await button.click();
    await menu.getByRole("button", { name: "Cerrar el menú" }).click();
    await expect(menu).toBeHidden();

    await button.click();
    await expect(menu).toBeVisible();
    // The backdrop covers the page to the left of the panel.
    await page.mouse.click(20, 400);
    await expect(menu).toBeHidden();
  });
});

// The reader's choice of the reduced mode is a cookie, which the page reads
// before its first paint: the band does not push the page down.
for (const route of ["/", "/galeria/figura-de-ocho", "/galeria/buscar"]) {
  test(`the band of the reader's choice is in the first paint of ${route}, without shifting the page`, async ({
    page,
    baseURL,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await chooseReducedMode(page, baseURL);
    await recordLayoutShifts(page);

    const answered = page.waitForResponse("**/api/atomy/status");
    await page.goto(route);
    await answered;

    const band = page.getByText(
      "Modo reducido: activado con el interruptor de la cabecera.",
    );
    await expect(band).toHaveCount(1);
    await expect(band).toBeVisible();
    expect(await layoutShift(page)).toBe(0);
    expect(errors).toEqual([]);
  });
}
