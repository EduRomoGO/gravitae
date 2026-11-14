import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { SECTION_IDS } from "../../src/lib/lesson/sections";
import { skipPresentation, unrollLesson } from "./lesson";
import { geminiRequests, type GeminiRequest } from "./gemini-requests";
import { FAKE_GEMINI_ORIGIN } from "./ports";

// The chat with Atomy of the advanced mode against the fake Gemini
// (e2e/fake-gemini.mts), which answers every question with these fragments.
const FIRST_FRAGMENT = "En la Luna la caja";
const FULL_ANSWER =
  "En la Luna la caja gana velocidad más despacio, por eso tarda más en caer.";
const FIRST_SECTION_TEXT = "Se sueltan simultáneamente tres cajas idénticas";

async function openChat(page: Page, baseURL: string | undefined) {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  await page
    .getByRole("button", { name: "Pregúntale a Atomy", exact: true })
    .click();
  return page.getByRole("region", { name: "Chat con Atomy" });
}

/** The state Atomy's drawing shows in the corner button. */
function dockAtomy(page: Page) {
  return page.locator("#atomy-dock svg");
}

async function ask(page: Page, question: string) {
  await page.getByRole("textbox", { name: "Tu pregunta" }).fill(question);
  await page
    .getByRole("region", { name: "Chat con Atomy" })
    .getByRole("button", { name: "Enviar" })
    .click();
}

/** A question no other test sends, to find its request in the fake Gemini. */
function uniqueQuestion(testId: string): string {
  return `¿Por qué la caja tarda más en la Luna? (${testId})`;
}

async function geminiRequestWith(
  request: APIRequestContext,
  text: string,
): Promise<GeminiRequest> {
  const all = await geminiRequests(request);
  const found = all.find((body) => JSON.stringify(body).includes(text));
  if (!found) throw new Error(`No Gemini request with ${text}`);
  return found;
}

test("a question gets the model's answer, arriving in fragments", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  const question = uniqueQuestion(testInfo.testId);
  await request.post(`${FAKE_GEMINI_ORIGIN}/__hold`, {
    data: { key: testInfo.testId },
  });
  const chat = await openChat(page, baseURL);

  await ask(page, question);

  await expect(chat).toContainText(question);
  await expect(chat).toContainText(FIRST_FRAGMENT);
  await expect(chat).not.toContainText(FULL_ANSWER);
  await request.post(`${FAKE_GEMINI_ORIGIN}/__release`, {
    data: { key: testInfo.testId },
  });
  await expect(chat.getByRole("listitem").last()).toHaveText(FULL_ANSWER);
});

test("a reload shows the conversation again, with the chat open", async ({
  page,
  baseURL,
}, testInfo) => {
  const question = uniqueQuestion(testInfo.testId);
  const chat = await openChat(page, baseURL);
  await ask(page, question);
  await expect(chat.getByRole("listitem").last()).toHaveText(FULL_ANSWER);

  await page.reload();

  await expect(chat).toContainText(question);
  await expect(chat.getByRole("listitem").last()).toHaveText(FULL_ANSWER);
});

test("a new conversation stays empty after a reload", async ({
  page,
  baseURL,
}, testInfo) => {
  const question = uniqueQuestion(testInfo.testId);
  const chat = await openChat(page, baseURL);
  await ask(page, question);
  await expect(chat.getByRole("listitem").last()).toHaveText(FULL_ANSWER);

  await chat.getByRole("button", { name: "Nueva conversación" }).click();
  await expect(chat.getByRole("listitem")).toHaveText([
    "¿En qué te puedo ayudar?",
  ]);
  await page.reload();

  await expect(chat.getByRole("listitem")).toHaveText([
    "¿En qué te puedo ayudar?",
  ]);
  await expect(chat).not.toContainText(question);
});

test("the model receives the visible section and, last, the reader's question as delimited user input", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  const question = uniqueQuestion(testInfo.testId);
  const chat = await openChat(page, baseURL);

  await ask(page, question);
  await expect(chat.getByRole("listitem").last()).toHaveText(FULL_ANSWER);

  const sent = await geminiRequestWith(request, testInfo.testId);
  const last = sent.contents.at(-1);
  const lastText = (last?.parts ?? []).map((part) => part.text ?? "").join("");
  expect(last?.role).toBe("user");
  expect(lastText).toContain(FIRST_SECTION_TEXT);
  expect(lastText.trimEnd()).toContain(
    `<pregunta_del_lector>\n${question}\n</pregunta_del_lector>`,
  );
  expect(lastText.trimEnd().endsWith("</pregunta_del_lector>")).toBe(true);
  expect(JSON.stringify(sent.systemInstruction)).not.toContain(question);
});

test("a number in the answer is the one the app computed with its calculation tool", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  // The fake Gemini calls compute_force_factor with masses 2 and 1 at three
  // times the distance, and then quotes the factor it receives.
  const question = `¿Cuánto cambia la fuerza? [guion:factor] (${testInfo.testId})`;
  const chat = await openChat(page, baseURL);

  await ask(page, question);

  await expect(chat.getByRole("listitem").last()).toHaveText(
    "La fuerza cambia ×2/9.",
  );
  const all = await geminiRequests(request);
  const turn = all.filter((body) =>
    JSON.stringify(body).includes(testInfo.testId),
  );
  expect(turn).toHaveLength(2);
});

test("every section of the lesson is one the chat accepts as visible", async ({
  page,
  baseURL,
}) => {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  await unrollLesson(page);

  const ids = await page
    .locator("main section[id][aria-labelledby]")
    .evaluateAll((sections) => sections.map((section) => section.id));

  expect(ids).toHaveLength(SECTION_IDS.length);
  for (const id of ids) expect(SECTION_IDS).toContain(id);
});

test("Atomy waits when the chat opens, talks while the answer arrives and waits again once it ends", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  await request.post(`${FAKE_GEMINI_ORIGIN}/__hold`, {
    data: { key: testInfo.testId },
  });
  const chat = await openChat(page, baseURL);
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "idle");

  await ask(page, uniqueQuestion(testInfo.testId));

  await expect(chat).toContainText(FIRST_FRAGMENT);
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "talking");
  await request.post(`${FAKE_GEMINI_ORIGIN}/__release`, {
    data: { key: testInfo.testId },
  });
  await expect(chat.getByRole("listitem").last()).toHaveText(FULL_ANSWER);
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "idle");
});

test("Atomy starts talking from where it rested", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  await request.post(`${FAKE_GEMINI_ORIGIN}/__hold`, {
    data: { key: testInfo.testId },
  });
  await openChat(page, baseURL);
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "idle");
  // Records the pose of the head and the face in the task that switches the
  // drawing to talking, before any frame is painted.
  await dockAtomy(page).evaluate((svg) => {
    new MutationObserver((_, observer) => {
      observer.disconnect();
      svg.dataset.talkingPoses = [".atom-sway", ".atom-face"]
        .flatMap((part) => {
          const element = svg.querySelector(part);
          if (!element) throw new Error(`Atomy has no ${part}`);
          const { a, b, c, d, e, f } = new DOMMatrix(
            getComputedStyle(element).transform,
          );
          return [a, b, c, d, e, f];
        })
        .join(" ");
    }).observe(svg, { attributeFilter: ["data-state"] });
  });

  await ask(page, uniqueQuestion(testInfo.testId));

  await expect(dockAtomy(page)).toHaveAttribute("data-state", "talking");
  const poses = await dockAtomy(page).evaluate((svg) =>
    (svg.dataset.talkingPoses ?? "").split(" ").map(Number),
  );
  const rest = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0];
  expect(poses).toHaveLength(rest.length);
  poses.forEach((value, i) => {
    expect(value).toBeCloseTo(rest[i] ?? NaN, 1);
  });
  await request.post(`${FAKE_GEMINI_ORIGIN}/__release`, {
    data: { key: testInfo.testId },
  });
});

test("Atomy settles from where its talking left it when it goes quiet", async ({
  page,
  baseURL,
  request,
}, testInfo) => {
  await request.post(`${FAKE_GEMINI_ORIGIN}/__hold`, {
    data: { key: testInfo.testId },
  });
  const chat = await openChat(page, baseURL);
  await ask(page, uniqueQuestion(testInfo.testId));
  await expect(chat).toContainText(FIRST_FRAGMENT);
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "talking");

  // Holds every talking motion away from its rest, and records the pose of
  // each part in the task that switches the drawing to idle, before any frame
  // is painted. A pose is the six numbers of the part's transform matrix.
  const talking = await dockAtomy(page).evaluate((svg) => {
    const poses = () =>
      [".atom-sway", ".atom-face", ".atom-pupils", ".atom-float"].flatMap(
        (part) => {
          // The breathing moves the <svg> itself.
          const element = svg.matches(part) ? svg : svg.querySelector(part);
          if (!element) throw new Error(`Atomy has no ${part}`);
          const { a, b, c, d, e, f } = new DOMMatrix(
            getComputedStyle(element).transform,
          );
          return [a, b, c, d, e, f];
        },
      );
    const offRest: Record<string, number> = {
      "atom-sway": 700,
      "atom-bob": 350,
      "atom-look": 1400,
    };
    for (const animation of svg.getAnimations({ subtree: true })) {
      if (!(animation instanceof CSSAnimation)) continue;
      const time = offRest[animation.animationName];
      if (time === undefined) continue;
      animation.currentTime = time;
      animation.pause();
    }
    new MutationObserver((_, observer) => {
      observer.disconnect();
      svg.dataset.quietPoses = poses().join(" ");
    }).observe(svg, { attributeFilter: ["data-state"] });
    return poses();
  });
  await request.post(`${FAKE_GEMINI_ORIGIN}/__release`, {
    data: { key: testInfo.testId },
  });
  await expect(dockAtomy(page)).toHaveAttribute("data-state", "idle");

  const quiet = await dockAtomy(page).evaluate((svg) =>
    (svg.dataset.quietPoses ?? "").split(" ").map(Number),
  );
  const rest = [1, 0, 0, 1, 0, 0];
  const pose = (poses: number[], part: number) =>
    poses.slice(part * 6, part * 6 + 6);
  for (const part of [0, 1, 2]) {
    expect(pose(talking, part)).not.toEqual(rest);
    pose(quiet, part).forEach((value, i) => {
      expect(value).toBeCloseTo(pose(talking, part)[i] ?? NaN, 1);
    });
  }
  pose(quiet, 3).forEach((value, i) => {
    expect(value).toBeCloseTo(rest[i] ?? NaN, 1);
  });
  await expect
    .poll(() =>
      dockAtomy(page).evaluate((svg) =>
        [".atom-sway", ".atom-face", ".atom-pupils"].map((part) => {
          const element = svg.querySelector(part);
          return element ? getComputedStyle(element).transform : "missing";
        }),
      ),
    )
    .toEqual(["none", "none", "none"]);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("Atomy does not move, even while it talks", async ({
    page,
    baseURL,
    request,
  }, testInfo) => {
    await request.post(`${FAKE_GEMINI_ORIGIN}/__hold`, {
      data: { key: testInfo.testId },
    });
    const chat = await openChat(page, baseURL);
    await ask(page, uniqueQuestion(testInfo.testId));
    await expect(chat).toContainText(FIRST_FRAGMENT);
    await expect(dockAtomy(page)).toHaveAttribute("data-state", "talking");

    const motion = await dockAtomy(page).evaluate((svg) => ({
      animations: svg.getAnimations({ subtree: true }).length,
      talkingMouth: getComputedStyle(
        svg.querySelector(".atom-mouth-talk") ?? svg,
      ).display,
    }));

    expect(motion).toEqual({ animations: 0, talkingMouth: "none" });
    await request.post(`${FAKE_GEMINI_ORIGIN}/__release`, {
      data: { key: testInfo.testId },
    });
  });
});

test("closing the chat and opening it again keeps the conversation", async ({
  page,
  baseURL,
}, testInfo) => {
  const question = uniqueQuestion(testInfo.testId);
  const chat = await openChat(page, baseURL);
  await ask(page, question);
  await expect(chat.getByRole("listitem").last()).toHaveText(FULL_ANSWER);

  await chat.getByRole("button", { name: "Cerrar el chat" }).click();
  await expect(chat).toHaveCount(0);
  await page
    .getByRole("button", { name: "Pregúntale a Atomy", exact: true })
    .click();

  await expect(chat.getByRole("listitem")).toHaveText([
    "¿En qué te puedo ayudar?",
    question,
    FULL_ANSWER,
  ]);
});

test("the corner button and the panel announce their name and state", async ({
  page,
  baseURL,
}) => {
  await skipPresentation(page, baseURL);
  await page.goto("/ley-gravitacion-universal-newton");
  const dock = page.getByRole("button", {
    name: "Pregúntale a Atomy",
    exact: true,
  });
  await expect(dock).toHaveAttribute("aria-expanded", "false");

  await dock.click();

  await expect(dock).toHaveAttribute("aria-expanded", "true");
  await expect(dock).toHaveAttribute("aria-controls", "atomy-chat");
  const chat = page.getByRole("region", { name: "Chat con Atomy" });
  await expect(chat).toHaveAttribute("id", "atomy-chat");
  await expect(
    chat.getByRole("textbox", { name: "Tu pregunta" }),
  ).toBeEnabled();
  await expect(chat.getByRole("button", { name: "Enviar" })).toBeEnabled();
  await expect(
    chat.getByRole("button", { name: "Cerrar el chat" }),
  ).toBeEnabled();
});

test.describe("on a desktop screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the corner button and the open panel stand beside the lesson's text", async ({
    page,
    baseURL,
  }) => {
    await skipPresentation(page, baseURL);
    await page.goto("/ley-gravitacion-universal-newton");
    await unrollLesson(page);
    const lesson = await page.locator("main").boundingBox();
    const dock = page.getByRole("button", {
      name: "Pregúntale a Atomy",
      exact: true,
    });
    const dockBox = await dock.boundingBox();

    await dock.click();
    const panel = await page
      .getByRole("region", { name: "Chat con Atomy" })
      .boundingBox();

    if (!lesson || !dockBox || !panel) throw new Error("Nothing to measure");
    expect(dockBox.x).toBeGreaterThanOrEqual(lesson.x + lesson.width);
    expect(panel.x).toBeGreaterThanOrEqual(lesson.x + lesson.width);
  });

  test("the open panel starts below the header, leaving its switch to the reader", async ({
    page,
    baseURL,
  }) => {
    await skipPresentation(page, baseURL);
    await page.goto("/ley-gravitacion-universal-newton");
    await page
      .getByRole("button", { name: "Pregúntale a Atomy", exact: true })
      .click();
    const header = await page.getByRole("banner").boundingBox();
    const panel = await page
      .getByRole("region", { name: "Chat con Atomy" })
      .boundingBox();
    if (!header || !panel) throw new Error("Nothing to measure");
    expect(panel.y).toBeGreaterThanOrEqual(header.y + header.height);

    const modeSwitch = page.getByRole("switch", { name: "Modo reducido" });
    await modeSwitch.click();
    await expect(modeSwitch).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the lesson's last line stays above the corner button", async ({
    page,
    baseURL,
  }) => {
    await skipPresentation(page, baseURL);
    await page.goto("/ley-gravitacion-universal-newton");
    await unrollLesson(page);
    await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight });
    });

    const lessonBottom = await page.locator("main").evaluate((main) => {
      const content = main.querySelectorAll(
        "p, h2, li, svg[role=img], input, a, button:not(#atomy-dock)",
      );
      return Math.max(
        ...[...content].map((node) => node.getBoundingClientRect().bottom),
      );
    });
    const dock = await page
      .getByRole("button", { name: "Pregúntale a Atomy", exact: true })
      .boundingBox();

    if (!dock) throw new Error("No corner button");
    expect(lessonBottom).toBeLessThanOrEqual(dock.y);
  });

  test("the panel opens at the bottom of the screen and closes", async ({
    page,
    baseURL,
  }) => {
    await skipPresentation(page, baseURL);
    await page.goto("/ley-gravitacion-universal-newton");
    await page
      .getByRole("button", { name: "Pregúntale a Atomy", exact: true })
      .click();
    const chat = page.getByRole("region", { name: "Chat con Atomy" });

    const panel = await chat.boundingBox();
    if (!panel) throw new Error("No panel");
    expect(panel.x).toBe(0);
    expect(panel.width).toBe(390);
    expect(panel.y + panel.height).toBeCloseTo(844, 0);

    await chat.getByRole("button", { name: "Cerrar el chat" }).click();
    await expect(chat).toHaveCount(0);
  });
});
