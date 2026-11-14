import { expect, test, type Page } from "@playwright/test";
import {
  LESSON_TITLE,
  chooseReducedMode,
  skipPresentation,
  unrollLesson,
  unrollUntilDistance,
} from "./lesson";
import { crossBrowser } from "./tags";

const HOME_GRAVITATION_LAW_BUTTON = "Aprende la ley de la gravitación";
const HEADER_GRAVITATION_LAW_LINK = "La ley de la gravitación";

// The sections of the lesson in order, with the stable id of each one.
const SECTIONS = [
  { id: "caida", heading: "Empecemos soltando tres cajas idénticas" },
  {
    id: "tiron",
    heading:
      "Las tres cajas son idénticas. Entonces, ¿qué cambia de un astro a otro?",
  },
  {
    id: "planeta",
    heading: "¿Qué determina la atracción de un planeta? ¿Su masa? ¿Su tamaño?",
  },
  { id: "distancia", heading: "¿Cuánto importa estar más lejos?" },
  { id: "cualquiera", heading: "¿Este fenómeno ocurre solo con los planetas?" },
  {
    id: "formula",
    heading: "Todo lo descubierto, sintetizado en una ecuación",
  },
  {
    id: "iguales",
    heading:
      "Si atraes a la Tierra con la misma fuerza que ella a ti, ¿por qué caes tú?",
  },
  { id: "mesa", heading: "¿Por qué no percibes la atracción de una mesa?" },
  { id: "tres", heading: "¿Y si en lugar de dos cuerpos intervienen tres?" },
];

const LESSON = "/ley-gravitacion-universal-newton";
const DOCK = "Pregúntale a Atomy";
const CHOSEN_NOTICE =
  "Modo reducido: activado con el interruptor de la cabecera. Puedes desactivarlo en cualquier momento. Atomy sigue guiando los experimentos sin IA.";

// The lesson in the reduced mode, unless a test says otherwise: the advanced
// mode, the app's default, has its own tests below.
test.beforeEach(async ({ page, baseURL }) => {
  await chooseReducedMode(page, baseURL);
});

test("the gravitation law page has its own tab title", async ({ page }) => {
  await page.goto("/ley-gravitacion-universal-newton");

  await expect(page).toHaveTitle(
    "Aprende la ley de la gravitación universal de Newton · Gravitae",
  );
});

test("a first visit opens with Atomy presenting itself, and the answer opens the lesson", async ({
  page,
}) => {
  await page.goto("/ley-gravitacion-universal-newton");
  const presentation = page.getByRole("region", { name: "Atomy se presenta" });

  await expect(presentation).toContainText("¡Hola! Soy Atomy.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Aprende la ley de la gravitación universal de Newton",
  );
  await page.getByRole("button", { name: "Sí", exact: true }).click();
  await expect(presentation).toContainText("¡Te veo en el primer experimento!");
  await page.getByRole("button", { name: "Entendido" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    LESSON_TITLE,
  );
  await expect(presentation).toHaveCount(0);
});

test("a reader who has met Atomy goes straight to the lesson", async ({
  page,
}) => {
  await page.goto("/ley-gravitacion-universal-newton");
  await page.getByRole("button", { name: "¡Claro que sí!" }).click();
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    LESSON_TITLE,
  );

  await page.reload();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    LESSON_TITLE,
  );
  await expect(
    page.getByRole("region", { name: "Atomy se presenta" }),
  ).toHaveCount(0);
});

test("the lesson shows one step at a time, each after the previous experiment", async ({
  page,
  baseURL,
}) => {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");

  await expect(page.locator("main section[id]")).toHaveCount(1);
  await expect(page.locator("#caida")).toBeVisible();
  const caida = page.locator("#caida");
  await caida.getByRole("button", { name: "Lo mismo" }).click();
  await expect(page.locator("#tiron")).toHaveCount(0);
  await caida.getByRole("button", { name: "Comprobar" }).click();

  await expect(caida.getByRole("status")).toContainText(
    "Has elegido «Lo mismo», pero la respuesta correcta es «Unas 2,5 veces menos».",
  );
  await expect(page.locator("#tiron")).toBeVisible();
});

test("the whole lesson shows its sections in order", async ({
  page,
  baseURL,
}) => {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");

  await unrollLesson(page);

  await expect(page.getByRole("heading", { level: 2 })).toHaveText(
    SECTIONS.map((section) => section.heading),
  );
  const sections = page.locator("main section[id]");
  await expect(sections).toHaveCount(SECTIONS.length);
  for (const [index, section] of SECTIONS.entries()) {
    await expect(sections.nth(index)).toHaveAttribute("id", section.id);
  }
});

test(
  "the gravitation law page has no horizontal scroll",
  crossBrowser,
  async ({ page, baseURL }) => {
    await page.goto("/ley-gravitacion-universal-newton");
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
    expect(await overflow()).toBeLessThanOrEqual(0);

    await skipPresentation(page, baseURL);
    await page.goto("/ley-gravitacion-universal-newton");
    await unrollLesson(page);

    expect(await overflow()).toBeLessThanOrEqual(0);
  },
);

test("the home link leads to the gravitation law page", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("main")
    .getByRole("link", { name: HOME_GRAVITATION_LAW_BUTTON })
    .click();

  await expect(page).toHaveURL("/ley-gravitacion-universal-newton");
  await expect(
    page.getByRole("region", { name: "Atomy se presenta" }),
  ).toBeVisible();
});

test("the header link leads to the gravitation law page from the gallery", async ({
  page,
}) => {
  await page.goto("/galeria");

  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: HEADER_GRAVITATION_LAW_LINK })
    .click();

  await expect(page).toHaveURL("/ley-gravitacion-universal-newton");
});

test("the last section of the gravitation law page leads to the gallery", async ({
  page,
  baseURL,
}) => {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  await unrollLesson(page);

  await page
    .locator("#tres")
    .getByRole("link", { name: "Explora seis órbitas de tres cuerpos" })
    .click();

  await expect(page).toHaveURL("/galeria");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Galería de los tres cuerpos",
  );
});

test("the table section asks what two astronauts do and compares their pull with an eyelash", async ({
  page,
  baseURL,
}) => {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  await unrollLesson(page);
  const mesa = page.locator("#mesa");

  await expect(mesa.getByRole("status").last()).toContainText(
    "tarda casi tres horas",
  );
  await expect(mesa).toContainText("inferior al peso de una pestaña");
  await expect(mesa).toContainText("más o menos lo que pesa una pestaña");
  await expect(page.getByRole("img", { name: /^Masa de A/ })).toHaveCount(0);
});

test("the old /aprende URL redirects to the lesson", async ({ page }) => {
  await page.goto("/aprende");

  await expect(page).toHaveURL(LESSON);
});

test("the advanced mode puts Atomy in the corner, with a chat that answers", async ({
  page,
  baseURL,
}) => {
  await page.context().clearCookies({ name: "atomy-modo" });
  await skipPresentation(page, baseURL);
  await page.goto(LESSON);
  const chat = page.getByRole("region", { name: "Chat con Atomy" });

  await page
    .getByRole("button", { name: "Pregúntale a Atomy", exact: true })
    .click();
  await expect(chat).toContainText("¿En qué te puedo ayudar?");
  await chat.getByRole("textbox", { name: "Tu pregunta" }).fill("¿Qué es g?");
  await chat.getByRole("button", { name: "Enviar" }).click();
  // The fake Gemini (e2e/fake-gemini.mts) answers every plain question so.
  await expect(chat).toContainText(
    "En la Luna la caja gana velocidad más despacio, por eso tarda más en caer.",
  );

  await page
    .locator("#caida")
    .getByRole("button", { name: "Pregúntale a Atomy sobre este experimento" })
    .click();
  await expect(chat).toContainText(
    "Sobre: Se sueltan simultáneamente tres cajas",
  );
});

test("the app opens in the advanced mode, with the header's switch on", async ({
  page,
  baseURL,
}) => {
  await page.context().clearCookies({ name: "atomy-modo" });
  await skipPresentation(page, baseURL);
  await page.goto(LESSON);

  await expect(
    page.getByRole("switch", { name: "Modo reducido" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: DOCK, exact: true }),
  ).toBeVisible();
});

test("the header's switch turns the reduced mode on and off, keeping the reader where they are", async ({
  page,
  baseURL,
}) => {
  await page.context().clearCookies({ name: "atomy-modo" });
  await skipPresentation(page, baseURL);
  await page.goto(LESSON);
  await unrollUntilDistance(page);
  const toggle = page.getByRole("switch", { name: "Modo reducido" });
  const dock = page.getByRole("button", { name: DOCK, exact: true });

  await toggle.click();

  await expect(toggle).toBeChecked();
  await expect(toggle).toHaveAccessibleDescription(CHOSEN_NOTICE);
  await expect(page.getByText(CHOSEN_NOTICE)).toBeVisible();
  await expect(dock).toHaveCount(0);
  await expect(page.locator("#distancia")).toBeVisible();
  await page.reload();
  await expect(toggle).toBeChecked();
  await expect(dock).toHaveCount(0);
  await expect(page.locator("#distancia")).toBeVisible();

  await toggle.click();

  await expect(toggle).not.toBeChecked();
  await expect(page.getByText(CHOSEN_NOTICE)).toHaveCount(0);
  await expect(dock).toBeVisible();
  await expect(page.locator("#distancia")).toBeVisible();
});

test("without a connection, the lesson goes on in the reduced mode, and the advanced one comes back with it", async ({
  page,
  context,
  baseURL,
}) => {
  await context.clearCookies({ name: "atomy-modo" });
  await skipPresentation(page, baseURL);
  await page.goto(LESSON);
  await unrollUntilDistance(page);
  const toggle = page.getByRole("switch", { name: "Modo reducido" });
  const dock = page.getByRole("button", { name: DOCK, exact: true });
  await expect(dock).toBeVisible();

  await context.setOffline(true);

  await expect(
    page.getByText(
      "Modo reducido: sin conexión con el modelo de lenguaje. Atomy sigue guiando los experimentos sin IA.",
    ),
  ).toBeVisible();
  await expect(toggle).toBeDisabled();
  await expect(toggle).toBeChecked();
  await expect(dock).toHaveCount(0);
  await expect(page.locator("#distancia")).toBeVisible();

  await context.setOffline(false);

  await expect(dock).toBeVisible();
  await expect(toggle).not.toBeChecked();
});

test("the prototype's controls are left out of production", async ({
  page,
  baseURL,
}) => {
  await skipPresentation(page, baseURL);
  await page.goto(`${LESSON}?todo`);

  await expect(page.locator("#caida")).toBeVisible();
  await expect(page.getByText(/PROTOTIPO/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ver la presentación de Atomy" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /lección/ })).toHaveCount(0);
  // ?todo, which shows the whole lesson at once, is ignored.
  await expect(page.locator("main section[id]")).toHaveCount(1);
});

test("a reload goes on where the reader was, back in the section they were reading", async ({
  page,
  baseURL,
}) => {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  await unrollUntilDistance(page);
  await page.locator("#tiron-titulo").evaluate((title) => {
    window.scrollTo({
      top: title.getBoundingClientRect().top + window.scrollY,
    });
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from({ length: localStorage.length }, (_, i) =>
          localStorage.getItem(localStorage.key(i) ?? ""),
        ).join(),
      ),
    )
    .toContain('"seccion":"tiron"');

  await page.reload();

  await expect(page.locator("#distancia")).toBeVisible();
  await expect(page.locator("#tiron-titulo")).toBeInViewport();
  await expect(
    page
      .locator("#caida")
      .getByRole("button", { name: "Unas 2,5 veces menos" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#caida").getByRole("status")).toContainText(
    "¡Has acertado!",
  );
  await expect(page.locator("#planeta").getByRole("status")).toContainText(
    "¡Has acertado!",
  );
});

test("while a reload restores the progress, the lesson stays hidden instead of showing its initial state", async ({
  page,
  baseURL,
}) => {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  await unrollUntilDistance(page);
  await expect
    .poll(() => page.evaluate(() => localStorage.length))
    .toBeGreaterThan(0);

  // Without the page's scripts, the lesson never restores: what the reader
  // would see until it does is the veil, which lifts by itself in the end.
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.reload();

  await expect(page.locator("#caida")).toBeAttached();
  await expect(page.locator("#caida")).toBeHidden();
  await expect(page.locator("#caida")).toBeVisible({ timeout: 5000 });
});

test("starting over asks first, then forgets the progress and opens with the presentation", async ({
  page,
  baseURL,
}) => {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  await unrollUntilDistance(page);

  await page.getByRole("button", { name: "Empezar de nuevo" }).click();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.locator("#distancia")).toBeVisible();
  await page.getByRole("button", { name: "Empezar de nuevo" }).click();
  await page.getByRole("button", { name: "Sí, empezar de nuevo" }).click();

  const presentation = page.getByRole("region", { name: "Atomy se presenta" });
  await expect(presentation).toBeVisible();
  await page.reload();
  await expect(presentation).toBeVisible();
  await page.getByRole("button", { name: "Sí", exact: true }).click();
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(page.locator("main section[id]")).toHaveCount(1);
  await expect(
    page
      .locator("#caida")
      .getByRole("button", { name: "Unas 2,5 veces menos" }),
  ).toHaveAttribute("aria-pressed", "false");
});

// A finger on a phone, through the Chrome DevTools Protocol: Playwright's
// touchscreen only taps. Chromium only.
async function swipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [from],
  });
  const steps = 10;
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
        },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}

test.describe("on a phone's touch screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "touch through the Chrome DevTools Protocol",
  );

  test("a vertical swipe that starts on a draggable drawing scrolls the page", async ({
    page,
    baseURL,
  }) => {
    await skipPresentation(page, baseURL);
    await page.goto(LESSON);
    await unrollLesson(page);

    for (const drawing of [
      page.locator("#tiron svg").filter({ hasText: "Dinamómetro colgado" }),
      page.locator("#cualquiera svg").first(),
    ]) {
      await drawing.evaluate((element) => {
        element.scrollIntoView({ block: "center" });
      });
      const box = await drawing.boundingBox();
      if (!box) throw new Error("the drawing is not laid out");
      const before = await page.evaluate(() => window.scrollY);
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;

      await swipe(page, { x, y }, { x, y: y - 200 });

      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(before + 100);
    }
  });

  test("the spring scale's handle is dragged sideways by a finger", async ({
    page,
    baseURL,
  }) => {
    await skipPresentation(page, baseURL);
    await page.goto(LESSON);
    await unrollUntilDistance(page);
    const drawing = page
      .locator("#tiron svg")
      .filter({ hasText: "Dinamómetro colgado" });
    await drawing.evaluate((element) => {
      element.scrollIntoView({ block: "center" });
    });
    const handle = await drawing
      .locator('[data-part="handle-touch"]')
      .boundingBox();
    const box = await drawing.boundingBox();
    if (!handle || !box) throw new Error("the drawing is not laid out");
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;

    // One planet to the left: from the Earth to the Moon.
    await swipe(page, { x, y }, { x: x - box.width / 3, y });

    await expect(drawing.locator("> title")).toHaveText(
      "Dinamómetro colgado sobre Luna",
    );
  });
});
