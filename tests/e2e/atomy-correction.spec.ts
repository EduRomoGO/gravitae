import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { chooseReducedMode, skipPresentation } from "./lesson";
import { FAKE_GEMINI_ORIGIN } from "./ports";

// The correction of the reader's reasoning in a prediction, in the advanced
// mode, against the fake Gemini (e2e/fake-gemini.mts): it answers with an
// incorrect verdict, the first misconception the section offers and
// CORRECTION_FEEDBACK, or with the verdict or broken output a marker in the
// reasoning asks for. The experiment waits until the reader opens it or a
// correction other than correct arrives; a correct one skips it.
const FALLBACK = /modelo de respaldo/;
const CORRECTION_FEEDBACK =
  "¿Cuántos hilos ves al doblar las dos masas? Cuéntalos en el experimento.";
const FIELD = "¿Por qué lo crees? (opcional)";
const WRONG = "Lo mismo";
const RIGHT = "Unas 2,5 veces menos";
const EXPERIMENT = "Hacer el experimento";
const SEE_ANYWAY = "Ver el experimento igualmente";
/** The drop race's control: the experiment of «caida» is shown. */
const DROP = "Soltar";
const CONTROLLED =
  "Atomy no ha podido corregir tu razonamiento esta vez. Puedes reintentarlo o seguir: la predicción se corrige igual al comprobarla.";

async function openLesson(page: Page, baseURL: string | undefined) {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  return page.locator("#caida");
}

function correctionOf(page: Page) {
  return page
    .locator("#caida")
    .getByRole("region", { name: "Corrección de tu razonamiento" });
}

/** A reasoning no other test sends, to find its requests in the fake Gemini. */
function reasoningFor(testId: string, marker = ""): string {
  return `Porque la gravedad no cambia lo que tarda ${marker} (${testId})`;
}

async function geminiRequestsWith(
  request: APIRequestContext,
  text: string,
): Promise<string[]> {
  const response = await request.get(`${FAKE_GEMINI_ORIGIN}/__requests`);
  const all: unknown = await response.json();
  return (Array.isArray(all) ? all : [])
    .map((body) => JSON.stringify(body))
    .filter((body) => body.includes(text));
}

test("the question shows its options, the reasoning's field and both buttons, with the experiment hidden", async ({
  page,
  baseURL,
}) => {
  const step = await openLesson(page, baseURL);

  await expect(step.getByRole("textbox", { name: FIELD })).toBeVisible();
  await expect(step.getByRole("button", { name: EXPERIMENT })).toBeDisabled();
  await step.getByRole("button", { name: WRONG, exact: true }).click();

  await expect(step.getByRole("button", { name: EXPERIMENT })).toBeEnabled();
  await expect(step.getByRole("button", { name: DROP })).toHaveCount(0);
  await expect(step.getByRole("button", { name: "Comprobar" })).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("the reader can skip the reasoning: the prediction corrects the option by code", async ({
  page,
  baseURL,
}) => {
  const step = await openLesson(page, baseURL);

  await step.getByRole("button", { name: WRONG, exact: true }).click();
  await step.getByRole("button", { name: EXPERIMENT }).click();
  await expect(step.getByRole("button", { name: DROP })).toBeVisible();
  await expectNoAxeViolations(page);
  await step.getByRole("button", { name: "Comprobar" }).click();

  await expect(step.getByRole("status").last()).toContainText(
    `Has elegido «${WRONG}», pero la respuesta correcta es «${RIGHT}».`,
  );
});

test("a scripted correction shows Atomy's explanation, and the verdict once the answer is checked", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  const reasoning = reasoningFor(testInfo.testId);
  const step = await openLesson(page, baseURL);
  await step.getByRole("button", { name: WRONG, exact: true }).click();

  await step.getByRole("textbox", { name: FIELD }).fill(reasoning);
  await step.getByRole("button", { name: "Enviar a Atomy" }).click();

  const correction = correctionOf(page);
  await expect(correction).toContainText(CORRECTION_FEEDBACK);
  await expect(correction).not.toContainText("idea equivocada");
  await expect(step.getByRole("button", { name: DROP })).toBeVisible();
  await expectNoAxeViolations(page);

  await step.getByRole("button", { name: "Comprobar" }).click();

  await expect(correction).toContainText(
    "Tu razonamiento se apoya en una idea equivocada.",
  );
  await expect(correction).toContainText("Idea a revisar:");
  await expectNoAxeViolations(page);

  const [text] = await geminiRequestsWith(request, testInfo.testId);
  expect(text).toContain("Se sueltan simultáneamente tres cajas idénticas");
  expect(text).toContain(`<elegida>${WRONG}</elegida>`);
  expect(text).toContain(`<correcta>${RIGHT}</correcta>`);
  expect(text).toContain("<revelada>no</revelada>");
  expect(text).toContain("<razonamiento_del_lector>");
  // The section arrives without the interface or the experiment.
  for (const noise of ["Enviar a Atomy", "caracteres", EXPERIMENT, DROP])
    expect(text).not.toContain(noise);
});

test("a correction from a fallback model, after the main one's 429, warns that it may be worse", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  const step = await openLesson(page, baseURL);
  await step.getByRole("button", { name: WRONG, exact: true }).click();

  await step
    .getByRole("textbox", { name: FIELD })
    .fill(reasoningFor(testInfo.testId, "[guion:respaldo]"));
  await step.getByRole("button", { name: "Enviar a Atomy" }).click();

  const correction = correctionOf(page);
  await expect(correction).toContainText(CORRECTION_FEEDBACK);
  await expect(correction).toContainText(FALLBACK);
  await expectNoAxeViolations(page);
  // The main model's request, which ran out of quota, and the fallback's.
  expect(await geminiRequestsWith(request, testInfo.testId)).toHaveLength(2);
});

test("a right reasoning before the experiment skips it, keeps it one click away and survives a reload", async ({
  page,
  baseURL,
}, testInfo) => {
  const step = await openLesson(page, baseURL);
  await step.getByRole("button", { name: RIGHT, exact: true }).click();

  await step
    .getByRole("textbox", { name: FIELD })
    .fill(reasoningFor(testInfo.testId, "[guion:razonamiento-correcto]"));
  await step.getByRole("button", { name: "Enviar a Atomy" }).click();

  const correction = correctionOf(page);
  await expect(correction).toContainText("¡Genial!");
  await expect(correction).toContainText(CORRECTION_FEEDBACK);
  await expect(correction).not.toContainText("Idea a revisar:");
  await expect(step.getByRole("status").last()).toContainText(
    "La caja en la Tierra tarda",
  );
  await expect(step.getByRole("button", { name: DROP })).toHaveCount(0);
  await expect(step.getByRole("button", { name: "Comprobar" })).toHaveCount(0);
  await expect(page.locator("#tiron")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.reload();
  const seeAnyway = step.getByRole("button", { name: SEE_ANYWAY });
  await expect(seeAnyway).toHaveAttribute("aria-expanded", "false");
  await expect(correction).toContainText("¡Genial!");
  await seeAnyway.click();
  await expect(seeAnyway).toHaveAttribute("aria-expanded", "true");
  await expect(step.getByRole("button", { name: DROP })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("a partial reasoning before the experiment shows it, without the verdict", async ({
  page,
  baseURL,
}, testInfo) => {
  const step = await openLesson(page, baseURL);
  await step.getByRole("button", { name: RIGHT, exact: true }).click();

  await step
    .getByRole("textbox", { name: FIELD })
    .fill(reasoningFor(testInfo.testId, "[guion:razonamiento-parcial]"));
  await step.getByRole("button", { name: "Enviar a Atomy" }).click();

  const correction = correctionOf(page);
  await expect(correction).toContainText(CORRECTION_FEEDBACK);
  await expect(correction).not.toContainText("Tu razonamiento");
  await expect(step.getByRole("button", { name: DROP })).toBeVisible();
  await expect(step.getByRole("button", { name: "Comprobar" })).toBeVisible();
  await expect(page.locator("#tiron")).toHaveCount(0);
  await expectNoAxeViolations(page);

  await step.getByRole("button", { name: "Comprobar" }).click();
  await expect(correction).toContainText(
    "Tu razonamiento es correcto en parte.",
  );
});

test("an output that breaks the rules gets one retry with its error", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  const step = await openLesson(page, baseURL);
  await step.getByRole("button", { name: WRONG, exact: true }).click();

  await step
    .getByRole("textbox", { name: FIELD })
    .fill(reasoningFor(testInfo.testId, "[guion:razonamiento-reintento]"));
  await step.getByRole("button", { name: "Enviar a Atomy" }).click();

  await expect(correctionOf(page)).toContainText(CORRECTION_FEEDBACK);
  const sent = await geminiRequestsWith(request, testInfo.testId);
  expect(sent).toHaveLength(2);
  expect(sent[1]).toContain("error_de_validacion");
});

test("two outputs that break the rules show the controlled message and keep the correction by code", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  const step = await openLesson(page, baseURL);
  await step.getByRole("button", { name: WRONG, exact: true }).click();

  await step
    .getByRole("textbox", { name: FIELD })
    .fill(reasoningFor(testInfo.testId, "[guion:razonamiento-invalido]"));
  await step.getByRole("button", { name: "Enviar a Atomy" }).click();

  const correction = correctionOf(page);
  await expect(correction).toContainText(CONTROLLED);
  await expect(step.getByRole("button", { name: DROP })).toBeVisible();
  expect(await geminiRequestsWith(request, testInfo.testId)).toHaveLength(2);
  await expect(
    correction.getByRole("button", { name: "Reintentar" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await step.getByRole("button", { name: "Comprobar" }).click();
  await expect(step.getByRole("status").last()).toContainText(
    `Has elegido «${WRONG}», pero la respuesta correcta es «${RIGHT}».`,
  );
});

test("the reasoning is written and sent from the keyboard", async ({
  page,
  baseURL,
}, testInfo) => {
  const step = await openLesson(page, baseURL);
  await step.getByRole("button", { name: WRONG, exact: true }).click();

  await step.getByRole("textbox", { name: FIELD }).focus();
  await page.keyboard.type(reasoningFor(testInfo.testId));
  await page.keyboard.press("Tab");
  await expect(
    step.getByRole("button", { name: "Enviar a Atomy" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(correctionOf(page)).toContainText(CORRECTION_FEEDBACK);
});

test("the reduced mode does not ask for the reasoning", async ({
  page,
  baseURL,
}) => {
  await chooseReducedMode(page, baseURL);
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  const step = page.locator("#caida");

  await step.getByRole("button", { name: WRONG, exact: true }).click();

  await expect(step.getByRole("textbox", { name: FIELD })).toHaveCount(0);
  await expect(step.getByRole("button", { name: EXPERIMENT })).toHaveCount(0);
  await expect(step.getByRole("button", { name: DROP })).toBeVisible();
  await expect(step.getByRole("button", { name: "Comprobar" })).toBeVisible();
});
