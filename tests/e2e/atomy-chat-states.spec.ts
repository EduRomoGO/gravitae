import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { checkPrediction, skipPresentation } from "./lesson";
import { FAKE_GEMINI_ORIGIN } from "./ports";

// The chat's states besides a plain answer, against the fake Gemini
// (e2e/fake-gemini.mts): its markers script each failure. Every state is
// checked with axe and, after a failure, the lesson keeps working.

const FIRST_FRAGMENT = "En la Luna la caja";
const FULL_ANSWER =
  "En la Luna la caja gana velocidad más despacio, por eso tarda más en caer.";
const THINKING = "Atomy está pensando…";
const RATE_LIMIT = "Límite de uso alcanzado, inténtalo más tarde.";
const FAILURE = /Atomy no ha podido responder/;
const INCOMPLETE = "Respuesta incompleta: se cortó por su longitud.";
const BLOCKED = /Atomy no puede responder a esa pregunta/;
const FALLBACK = /modelo de respaldo/;

async function openChat(
  page: Page,
  baseURL: string | undefined,
): Promise<Locator> {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
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

/** A question no other test sends, with the fake Gemini's marker, if any. */
function questionFor(testId: string, marker = ""): string {
  return `¿Por qué la caja tarda más en la Luna? (${testId}) ${marker}`.trim();
}

/** The conversation's messages, without the live region that repeats them. */
function conversation(chat: Locator): Locator {
  return chat.getByRole("list");
}

function dockAtomy(page: Page): Locator {
  return page.locator("#atomy-dock svg");
}

/** The first experiment still checks the reader's prediction. */
async function expectLessonWorks(page: Page) {
  const step = page.locator("#caida");
  await step
    .getByRole("button", { name: "Unas 2,5 veces menos", exact: true })
    .click();
  await checkPrediction(step);
  await expect(step.getByRole("status").last()).toBeVisible();
}

test("a slow answer shows that Atomy is thinking until its first fragment", async ({
  page,
  baseURL,
}, testInfo) => {
  const chat = await openChat(page, baseURL);

  await ask(page, questionFor(testInfo.testId, "[guion:lento]"));

  await expect(conversation(chat).getByText(THINKING)).toBeVisible();
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "talking");
  await expectNoAxeViolations(page);
  await expect(conversation(chat).getByRole("listitem").last()).toHaveText(
    FULL_ANSWER,
  );
  await expect(conversation(chat).getByText(THINKING)).toHaveCount(0);
});

test("stopping an answer keeps its text so far and leaves Atomy waiting", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  await request.post(`${FAKE_GEMINI_ORIGIN}/__hold`, {
    data: { key: testInfo.testId },
  });
  const chat = await openChat(page, baseURL);
  await ask(page, questionFor(testInfo.testId));
  const stop = chat.getByRole("button", { name: "Detener la respuesta" });
  await expect(chat).toContainText(FIRST_FRAGMENT);
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "talking");
  await expect(stop).toBeVisible();
  await expect(chat).not.toContainText(FAILURE);

  await stop.click();

  await expect(dockAtomy(page)).toHaveAttribute("data-state", "idle");
  await expect(chat).toContainText(FIRST_FRAGMENT);
  await expect(chat).not.toContainText(FULL_ANSWER);
  await expect(chat.getByRole("button", { name: "Enviar" })).toBeVisible();
  await expectNoAxeViolations(page);
  await request.post(`${FAKE_GEMINI_ORIGIN}/__release`, {
    data: { key: testInfo.testId },
  });
});

test("a 429 says the usage limit was reached, stops Atomy and leaves the lesson working", async ({
  page,
  baseURL,
}, testInfo) => {
  const chat = await openChat(page, baseURL);

  await ask(page, questionFor(testInfo.testId, "[guion:429]"));

  await expect(conversation(chat).getByText(RATE_LIMIT)).toBeVisible();
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "stopped");
  await expectNoAxeViolations(page);
  await chat.getByRole("button", { name: "Seguir leyendo" }).click();
  await expect(chat).toBeHidden();
  await expectLessonWorks(page);
});

test("an answer from a fallback model, after the main one's 429, warns that it may be worse", async ({
  page,
  baseURL,
}, testInfo) => {
  const chat = await openChat(page, baseURL);

  await ask(page, questionFor(testInfo.testId, "[guion:respaldo]"));

  await expect(conversation(chat)).toContainText(FULL_ANSWER);
  await expect(conversation(chat).getByText(FALLBACK)).toBeVisible();
  await expect(conversation(chat)).not.toContainText(RATE_LIMIT);
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "idle");
  await expectNoAxeViolations(page);
});

test("a provider failure offers to retry, and retrying sends the last question again", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  await request.post(`${FAKE_GEMINI_ORIGIN}/__fail`, {
    data: { key: testInfo.testId },
  });
  const chat = await openChat(page, baseURL);
  const question = questionFor(testInfo.testId);

  await ask(page, question);

  await expect(conversation(chat).getByText(FAILURE)).toBeVisible();
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "stopped");
  await expect(
    chat.getByRole("button", { name: "Seguir leyendo" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  await request.post(`${FAKE_GEMINI_ORIGIN}/__recover`, {
    data: { key: testInfo.testId },
  });
  await chat.getByRole("button", { name: "Reintentar" }).click();
  await expect(conversation(chat).getByRole("listitem")).toHaveText([
    "¿En qué te puedo ayudar?",
    question,
    FULL_ANSWER,
  ]);
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "idle");
});

/**
 * Records where each electron of the corner Atomy is in the task that next
 * switches its state, before any frame is painted, as offset-distance
 * percentages.
 */
async function recordElectronsAtNextSwitch(page: Page) {
  await dockAtomy(page).evaluate((svg) => {
    new MutationObserver((_, observer) => {
      observer.disconnect();
      svg.dataset.switchLaps = [...svg.querySelectorAll(".atom-electron")]
        .map((electron) => getComputedStyle(electron).offsetDistance)
        .join(" ");
    }).observe(svg, { attributeFilter: ["data-state"] });
  });
}

async function recordedLaps(page: Page): Promise<number[]> {
  return dockAtomy(page).evaluate((svg) =>
    (svg.dataset.switchLaps ?? "").split(" ").map(Number.parseFloat),
  );
}

async function currentLaps(page: Page): Promise<number[]> {
  return dockAtomy(page).evaluate((svg) =>
    [...svg.querySelectorAll(".atom-electron")].map((electron) =>
      Number.parseFloat(getComputedStyle(electron).offsetDistance),
    ),
  );
}

test("the electrons stop where they are when Atomy stops, and carry on from there when it talks again", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  await request.post(`${FAKE_GEMINI_ORIGIN}/__fail`, {
    data: { key: testInfo.testId },
  });
  const chat = await openChat(page, baseURL);
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "idle");
  // Holds the electrons halfway round, away from their resting places.
  await dockAtomy(page).evaluate((svg) => {
    for (const animation of svg.getAnimations({ subtree: true })) {
      if (!(animation instanceof CSSAnimation)) continue;
      if (animation.animationName !== "atom-orbit") continue;
      const duration = Number(animation.effect?.getTiming().duration);
      animation.currentTime = duration / 2;
      animation.pause();
    }
  });
  const held = await currentLaps(page);
  await recordElectronsAtNextSwitch(page);

  await ask(page, questionFor(testInfo.testId));

  await expect(conversation(chat).getByText(FAILURE)).toBeVisible();
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "stopped");
  const stopped = await currentLaps(page);
  expect(stopped).toHaveLength(2);
  stopped.forEach((lap, i) => {
    expect(lap).toBeCloseTo(held[i] ?? NaN, 0);
  });

  await recordElectronsAtNextSwitch(page);
  await request.post(`${FAKE_GEMINI_ORIGIN}/__recover`, {
    data: { key: testInfo.testId },
  });
  await chat.getByRole("button", { name: "Reintentar" }).click();
  await expect(dockAtomy(page)).not.toHaveAttribute("data-state", "stopped");
  const resumed = await recordedLaps(page);
  resumed.forEach((lap, i) => {
    expect(lap).toBeCloseTo(stopped[i] ?? NaN, 0);
  });
});

test("an answer cut by its length is marked as incomplete and stops Atomy", async ({
  page,
  baseURL,
}, testInfo) => {
  const chat = await openChat(page, baseURL);

  await ask(page, questionFor(testInfo.testId, "[guion:longitud]"));

  await expect(conversation(chat).getByText(INCOMPLETE)).toBeVisible();
  await expect(conversation(chat)).toContainText(FULL_ANSWER);
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "stopped");
  await expectNoAxeViolations(page);
});

test("a blocked question gets the chat's own message and stops Atomy", async ({
  page,
  baseURL,
}, testInfo) => {
  const chat = await openChat(page, baseURL);

  await ask(page, questionFor(testInfo.testId, "[guion:bloqueado]"));

  await expect(conversation(chat).getByText(BLOCKED)).toBeVisible();
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "stopped");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Cerrar el chat" }).click();
  await expectLessonWorks(page);
});

test("the answer is announced once, whole, in a polite live region", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  await request.post(`${FAKE_GEMINI_ORIGIN}/__hold`, {
    data: { key: testInfo.testId },
  });
  const chat = await openChat(page, baseURL);
  const live = chat.getByRole("status");

  await ask(page, questionFor(testInfo.testId));

  await expect(chat).toContainText(FIRST_FRAGMENT);
  await expect(live).toBeEmpty();
  await request.post(`${FAKE_GEMINI_ORIGIN}/__release`, {
    data: { key: testInfo.testId },
  });
  await expect(live).toHaveText(FULL_ANSWER);
});

test("the chat opens, takes a question, stops and closes from the keyboard, with focus kept while the answer arrives", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  await request.post(`${FAKE_GEMINI_ORIGIN}/__hold`, {
    data: { key: testInfo.testId },
  });
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  const dock = page.getByRole("button", {
    name: "Pregúntale a Atomy",
    exact: true,
  });
  await dock.focus();
  await page.keyboard.press("Enter");
  const chat = page.getByRole("region", { name: "Chat con Atomy" });
  await expect(chat).toBeVisible();

  const input = chat.getByRole("textbox", { name: "Tu pregunta" });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await page.keyboard.type(questionFor(testInfo.testId));
  await page.keyboard.press("Enter");
  await expect(chat).toContainText(FIRST_FRAGMENT);
  await expect(input).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(
    chat.getByRole("button", { name: "Detener la respuesta" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "idle");
  await expect(chat.getByRole("button", { name: "Enviar" })).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(
    chat.getByRole("button", { name: "Cerrar el chat" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(chat).toBeHidden();
  await request.post(`${FAKE_GEMINI_ORIGIN}/__release`, {
    data: { key: testInfo.testId },
  });
});
