import { expect, test } from "@playwright/test";
import { crossBrowser } from "./tags";

// Every slug's title, description and facts are checked by app/galeria/[slug]/page.test.tsx;
// here one slug checks that the server serves and the browser draws a detail.
test("opening a detail directly shows its title, description and full orbit", async ({
  page,
}) => {
  const response = await page.goto("/galeria/figura-de-ocho");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Figura de ocho",
  );
  await expect(
    page.getByText(
      "Los tres cuerpos recorren, uno tras otro, una misma curva con forma de 8.",
    ),
  ).toBeVisible();

  const drawing = page.locator('main svg[role="img"]');
  await expect(drawing).toBeVisible();
  await expect(drawing.locator('path[data-part="path"]')).toHaveCount(3);
  for (const orbit of await drawing.locator('path[data-part="path"]').all()) {
    await expect(orbit).toHaveAttribute("d", /^M.+C.+Z$/);
  }
  await expect(
    page.getByRole("status", { name: "Calculando la órbita" }),
  ).toHaveCount(0);
});

test(
  "on each frame only the three bodies and the trail change",
  crossBrowser,
  async ({ page }) => {
    await page.goto("/galeria/figura-de-ocho");
    await expect(page.locator('main svg[role="img"] circle')).toHaveCount(3);

    const changes = await page.evaluate(
      () =>
        new Promise<{ changed: string[]; elements: number }>((resolve) => {
          const drawing = document.querySelector('main svg[role="img"]');
          if (!drawing) throw new Error("The drawing is not in the page");
          const records: MutationRecord[] = [];
          const observer = new MutationObserver((batch) => {
            records.push(...batch);
          });
          observer.observe(drawing, {
            attributes: true,
            characterData: true,
            childList: true,
            subtree: true,
          });
          let frames = 10;
          const onFrame = () => {
            if (--frames > 0) {
              requestAnimationFrame(onFrame);
              return;
            }
            records.push(...observer.takeRecords());
            observer.disconnect();
            resolve({
              changed: [
                ...new Set(
                  records.map(
                    ({ target, type, attributeName }) =>
                      `${target.nodeName}:${attributeName ?? type}`,
                  ),
                ),
              ].sort(),
              elements: new Set(records.map(({ target }) => target)).size,
            });
          };
          requestAnimationFrame(onFrame);
        }),
    );

    // The trails move as dashes along the orbits, without new path data.
    expect(changes).toEqual({
      changed: [
        "circle:cx",
        "circle:cy",
        "path:stroke-dasharray",
        "path:stroke-dashoffset",
      ],
      elements: 6,
    });
  },
);

test(
  "each body has its own color and moves along its trail",
  crossBrowser,
  async ({ page }) => {
    await page.goto("/galeria/figura-de-ocho");
    const bodies = page.locator('main svg[role="img"] circle');
    await expect(bodies).toHaveCount(3);

    const colors = await bodies.evaluateAll((circles) =>
      circles.map((circle) => getComputedStyle(circle).fill),
    );
    expect(new Set(colors).size).toBe(3);

    const startX = await bodies.first().getAttribute("cx");
    await expect.poll(() => bodies.first().getAttribute("cx")).not.toBe(startX);
  },
);

test(
  "the asterisk of the initial conditions leads to their explanation in the gallery",
  crossBrowser,
  async ({ page }) => {
    await page.goto("/galeria/figura-de-ocho");

    await page
      .getByRole("link", { name: "Qué son las condiciones iniciales" })
      .click();

    await expect(page).toHaveURL(/\/galeria#condiciones-iniciales$/);
    const explanation = page.getByRole("region", {
      name: "Condiciones iniciales",
    });
    await expect(explanation).toBeInViewport();
    await expect(explanation).toContainText(
      "la posición y la velocidad de cada cuerpo",
    );
  },
);

test(
  "the detail's facts link to their explanation in the gallery",
  crossBrowser,
  async ({ page }) => {
    await page.goto("/galeria/goggles");

    await page.getByRole("link", { name: "Qué significa inestable" }).click();

    await expect(page).toHaveURL(/\/galeria#estabilidad$/);
    await expect(
      page.getByRole("region", { name: "Estabilidad" }),
    ).toBeInViewport();
  },
);

test(
  "moving to the next solution puts the focus on its title",
  crossBrowser,
  async ({ page }) => {
    await page.goto("/galeria/goggles");

    await page
      .getByRole("navigation", { name: "Otras soluciones" })
      .getByRole("link", { name: "Solución: Moth I →", exact: true })
      .click();

    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveText("Moth I");
    await expect(title).toBeFocused();
  },
);

test("entering a detail by its URL focuses its title without a focus ring", async ({
  page,
}) => {
  await page.goto("/galeria/figura-de-ocho");

  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toBeFocused();
  await expect(title).toHaveCSS("outline-style", "none");
});

test("an unknown slug shows the 404 page, with the way back to the lesson and the gallery", async ({
  page,
}) => {
  const response = await page.goto("/galeria/no-existe");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Página no encontrada",
  );
  const main = page.getByRole("main");
  await main.getByRole("link", { name: "la galería de órbitas" }).click();
  await expect(page).toHaveURL(/\/galeria$/);
  await page.goBack();
  await main.getByRole("link", { name: "la lección" }).click();
  await expect(page).toHaveURL(/\/ley-gravitacion-universal-newton$/);
});

test.describe("before the browser runs any JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the server HTML has the title and a CSS-animated spinner in place of the orbit", async ({
    page,
  }) => {
    await page.goto("/galeria/goggles");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Goggles");
    const spinner = page.getByRole("status", { name: "Calculando la órbita" });
    await expect(spinner).toBeVisible();
    await expect(spinner).toHaveCSS("animation-name", "spin");
    await expect(page.locator('main svg[role="img"]')).toHaveCount(0);
  });
});

test.describe("on a laptop screen", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the playback controls are above the fold", async ({ page }) => {
    await page.goto("/galeria/figura-de-ocho");

    await expect(page.getByRole("button", { name: "Pausar" })).toBeInViewport({
      ratio: 1,
    });
  });
});
