import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { skipPresentation, unrollLesson } from "./lesson";
import { crossBrowser } from "./tags";

const GRAVITATION_LAW_LINK = "La ley de la gravitación";
const HEADER_LINK = "Órbitas de tres cuerpos";
const HEADER_FINDER_LINK = "Busca tu solución";
const HOME_LINK = "Gravitae";
const HOME_GRAVITATION_LAW_BUTTON = "Aprende la ley de la gravitación";
const HOME_GALLERY_BUTTON = "Explora órbitas de tres cuerpos";
const HOME_FINDER_BUTTON = "Busca tu solución";
const CARD_NAMES = [
  "Lagrange",
  "Figura de ocho",
  "Butterfly I",
  "Goggles",
  "Moth I",
  "Yin-Yang I",
];

// WebKit on macOS skips links with Tab, as Safari does by default; Alt+Tab
// is the key that reaches every interactive element.
function tabKey(browserName: string): string {
  return browserName === "webkit" ? "Alt+Tab" : "Tab";
}

/** The header's switch of the advanced mode, after its links. */
const MODE_SWITCH = "Modo reducido";

async function expectFocusVisible(element: Locator) {
  await expect(element).toBeFocused();
  const focus = await element.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      matchesFocusVisible: node.matches(":focus-visible"),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focus.matchesFocusVisible).toBe(true);
  expect(focus.outlineStyle).not.toBe("none");
  expect(focus.outlineWidth).toBeGreaterThan(0);
}

async function tabThrough(page: Page, key: string, stops: Locator[]) {
  for (const stop of stops) {
    await page.keyboard.press(key);
    await expectFocusVisible(stop);
  }
}

test(
  "the tab key reaches the home links with a visible focus",
  crossBrowser,
  async ({ page, browserName }) => {
    await page.goto("/");
    const main = page.getByRole("main");

    await tabThrough(page, tabKey(browserName), [
      page.getByRole("link", { name: HOME_LINK, exact: true }),
      page.getByRole("link", { name: GRAVITATION_LAW_LINK, exact: true }),
      page.getByRole("link", { name: HEADER_LINK, exact: true }),
      page
        .getByRole("navigation")
        .getByRole("link", { name: HEADER_FINDER_LINK, exact: true }),
      page.getByRole("switch", { name: MODE_SWITCH }),
      main.getByRole("link", {
        name: HOME_GRAVITATION_LAW_BUTTON,
        exact: true,
      }),
      main.getByRole("link", { name: HOME_GALLERY_BUTTON, exact: true }),
      main.getByRole("link", { name: HOME_FINDER_BUTTON, exact: true }),
    ]);
  },
);

test(
  "the tab key reaches the finder's link, the pause button and every gallery card with a visible focus",
  crossBrowser,
  async ({ page, browserName }) => {
    await page.goto("/galeria");

    await tabThrough(page, tabKey(browserName), [
      page.getByRole("link", { name: HOME_LINK, exact: true }),
      page.getByRole("link", { name: GRAVITATION_LAW_LINK, exact: true }),
      page.getByRole("link", { name: HEADER_LINK, exact: true }),
      page.getByRole("link", { name: HEADER_FINDER_LINK, exact: true }),
      page.getByRole("switch", { name: MODE_SWITCH }),
      page.getByRole("link", { name: "busca tu propia órbita" }),
      page.getByRole("button", { name: "Pausar animaciones" }),
      ...CARD_NAMES.map((name) => page.getByRole("link", { name })),
    ]);
  },
);

test(
  "the tab key reaches every control of the detail with a visible focus",
  crossBrowser,
  async ({ page, browserName }) => {
    await page.goto("/galeria/figura-de-ocho");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    const key = tabKey(browserName);

    await tabThrough(page, key, [
      page.getByRole("button", { name: "Pausar" }),
      page.getByRole("button", { name: "Reiniciar" }),
      page.getByRole("button", { name: "0,5×", exact: true }),
      page.getByRole("button", { name: "1×", exact: true }),
      page.getByRole("button", { name: "2×", exact: true }),
      page.getByRole("checkbox", { name: "Estela" }),
      page.getByRole("checkbox", { name: "Órbita completa" }),
      page.getByRole("link", { name: "Qué es la unidad de tiempo" }),
      page.getByRole("link", { name: "Qué es el instante 0" }),
      page.getByRole("link", { name: "Qué significa estable" }),
      page.getByRole("link", { name: "Qué son las condiciones iniciales" }),
      page.getByRole("link", { name: /^Xiaoming Li y Shijun Liao/ }),
      page.getByRole("link", { name: "← Solución: Lagrange" }),
      page.getByRole("link", { name: "Solución: Butterfly I →" }),
    ]);
  },
);

test(
  "shift+tab from the detail's title reaches the links above it with a visible focus",
  crossBrowser,
  async ({ page, browserName }) => {
    await page.goto("/galeria/figura-de-ocho");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();

    await tabThrough(page, `Shift+${tabKey(browserName)}`, [
      page.getByRole("link", { name: "← Galería" }),
      page.getByRole("switch", { name: MODE_SWITCH }),
      page.getByRole("link", { name: HEADER_FINDER_LINK, exact: true }),
      page.getByRole("link", { name: HEADER_LINK, exact: true }),
      page.getByRole("link", { name: GRAVITATION_LAW_LINK, exact: true }),
      page.getByRole("link", { name: HOME_LINK, exact: true }),
    ]);
  },
);

test(
  "the tab key reaches the header links of the 404 page with a visible focus",
  crossBrowser,
  async ({ page, browserName }) => {
    await page.goto("/galeria/no-existe");

    await tabThrough(page, tabKey(browserName), [
      page.getByRole("link", { name: HOME_LINK, exact: true }),
      page.getByRole("link", { name: GRAVITATION_LAW_LINK, exact: true }),
      page.getByRole("link", { name: HEADER_LINK, exact: true }),
      page.getByRole("link", { name: HEADER_FINDER_LINK, exact: true }),
    ]);
  },
);

// One detail stands for all six: they share the template and differ only in text.
const PAGES = [
  "/",
  "/galeria",
  "/galeria/figura-de-ocho",
  "/galeria/no-existe",
];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`with the ${colorScheme} color scheme`, () => {
    test.use({ colorScheme });

    for (const path of PAGES) {
      test(`${path} has no axe violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        // The spinners are replaced by the drawings once the orbits are ready.
        // Matched by name, because the explorer's result is a `status` too.
        await expect(
          page.getByRole("status", { name: "Calculando la órbita" }),
        ).toHaveCount(0, { timeout: 30_000 });

        await expectNoAxeViolations(page);
      });
    }
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`the lesson with the ${colorScheme} color scheme`, () => {
    test.use({ colorScheme });

    test("Atomy's presentation has no axe violations", async ({ page }) => {
      await page.goto("/ley-gravitacion-universal-newton");
      await expect(
        page.getByRole("button", { name: "Sí", exact: true }),
      ).toBeVisible();

      await expectNoAxeViolations(page);
    });

    test("the whole lesson has no axe violations", async ({
      page,
      baseURL,
    }) => {
      await skipPresentation(page, baseURL);
      await page.goto("/ley-gravitacion-universal-newton");
      await unrollLesson(page);

      await expectNoAxeViolations(page);
    });

    test("the advanced mode with the chat open has no axe violations", async ({
      page,
      baseURL,
    }) => {
      await skipPresentation(page, baseURL);
      await page.goto("/ley-gravitacion-universal-newton");
      await page
        .getByRole("button", { name: "Pregúntale a Atomy", exact: true })
        .click();
      await expect(
        page.getByRole("region", { name: "Chat con Atomy" }),
      ).toBeVisible();

      await expectNoAxeViolations(page);
    });

    test("a conversation with Atomy has no axe violations", async ({
      page,
      baseURL,
    }) => {
      await skipPresentation(page, baseURL);
      await page.goto("/ley-gravitacion-universal-newton");
      await page
        .getByRole("button", { name: "Pregúntale a Atomy", exact: true })
        .click();
      const chat = page.getByRole("region", { name: "Chat con Atomy" });
      await chat
        .getByRole("textbox", { name: "Tu pregunta" })
        .fill("¿Qué es g?");
      await chat.getByRole("button", { name: "Enviar" }).click();
      await expect(chat.getByRole("listitem")).toHaveCount(3);
      await expect(chat.getByRole("listitem").last()).not.toBeEmpty();

      await expectNoAxeViolations(page);
    });

    test("the chat open on a phone has no axe violations", async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await skipPresentation(page, baseURL);
      await page.goto("/ley-gravitacion-universal-newton");
      await page
        .getByRole("button", { name: "Pregúntale a Atomy", exact: true })
        .click();
      await expect(
        page.getByRole("region", { name: "Chat con Atomy" }),
      ).toBeVisible();

      await expectNoAxeViolations(page);
    });
  });
}
