import { expect, test, type Page } from "@playwright/test";
import { skipPresentation, unrollLesson } from "./lesson";
import { crossBrowser } from "./tags";

// Layout checks that hold whatever the design: nothing scrolls sideways,
// nothing is cut off at the edges of the window and no text or control is
// drawn over another one. They stand in for screenshot comparisons while the
// design keeps changing.

/** From the narrowest phone to a desktop. */
const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

/** Subpixel rounding differs between engines; a 1 px gap is not a defect. */
const TOLERANCE_PX = 1;

interface LayoutDefects {
  scrollWidth: number;
  clientWidth: number;
  /** Elements that reach past the left or right edge of the window. */
  cutOff: string[];
  /** Pairs of texts or controls drawn one over the other. */
  overlaps: string[];
}

function layoutDefects(page: Page): Promise<LayoutDefects> {
  return page.evaluate((tolerance) => {
    const clientWidth = document.documentElement.clientWidth;

    function describe(element: Element): string {
      const text = element.textContent.trim().replace(/\s+/g, " ");
      const label = element.getAttribute("aria-label") ?? text.slice(0, 40);
      return `<${element.tagName.toLowerCase()}> "${label}"`;
    }

    function isShown(element: Element): boolean {
      if (
        !element.checkVisibility({
          visibilityProperty: true,
          opacityProperty: true,
        })
      )
        return false;
      const rect = element.getBoundingClientRect();
      // Visually hidden text (sr-only) is 1 px wide on purpose.
      return rect.width > tolerance && rect.height > tolerance;
    }

    /** Inside a box that scrolls sideways, reaching past its edge is by design. */
    function insideHorizontalScroller(element: Element): boolean {
      for (
        let parent = element.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (parent === document.body) return false;
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") return true;
      }
      return false;
    }

    /** Fixed and sticky boxes float over the content scrolled under them. */
    function isFloating(element: Element): boolean {
      for (
        let node: Element | null = element;
        node;
        node = node.parentElement
      ) {
        const position = getComputedStyle(node).position;
        if (position === "fixed" || position === "sticky") return true;
      }
      return false;
    }

    const boxes = [
      ...document.querySelectorAll(
        "body h1, body h2, body h3, body h4, body p, body li, body label, body a, body button, body input, body select, body textarea, body svg",
      ),
    ]
      // An SVG counts as one box: the text inside it is laid out by its scale.
      .filter((element) => !element.parentElement?.closest("svg"))
      .filter(isShown);

    const cutOff = boxes
      .filter((element) => !insideHorizontalScroller(element))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -tolerance || rect.right > clientWidth + tolerance;
      })
      .map(describe);

    const CONTROLS = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

    /**
     * What the element paints, line by line: a control's boxes, and a text
     * block's own lines of text. A paragraph's box runs under a floated avatar
     * beside it while its text wraps around it, and an inline link that wraps
     * has a bounding box wider than the text it draws.
     */
    function drawnRects(element: Element): DOMRect[] {
      if (CONTROLS.has(element.tagName)) return [...element.getClientRects()];
      const range = document.createRange();
      return [...element.childNodes]
        .filter(
          (node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        )
        .flatMap((node) => {
          range.selectNodeContents(node);
          return [...range.getClientRects()];
        });
    }

    // A drawing may carry controls over it, so SVGs take no part.
    const texts = boxes
      .filter((element) => element.tagName !== "svg" && !isFloating(element))
      .map((element) => ({ element, rects: drawnRects(element) }));
    const overlaps: string[] = [];
    for (const [
      index,
      { element: first, rects: firstRects },
    ] of texts.entries()) {
      for (const { element: second, rects: secondRects } of texts.slice(
        index + 1,
      )) {
        if (first.contains(second) || second.contains(first)) continue;
        const collide = firstRects.some((a) =>
          secondRects.some(
            (b) =>
              Math.min(a.right, b.right) - Math.max(a.left, b.left) >
                tolerance &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tolerance,
          ),
        );
        if (collide) overlaps.push(`${describe(first)} × ${describe(second)}`);
      }
    }

    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth,
      cutOff,
      overlaps,
    };
  }, TOLERANCE_PX);
}

/** Checks the open page at every viewport, resizing it in place. */
async function expectSoundLayout(page: Page): Promise<void> {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    // Two frames, so the resize has been laid out and the ResizeObservers run.
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const at = `at ${String(viewport.width)}x${String(viewport.height)}`;
    const defects = await layoutDefects(page);

    expect
      .soft(defects.scrollWidth, `horizontal scroll ${at}`)
      .toBeLessThanOrEqual(defects.clientWidth);
    expect.soft(defects.cutOff, `cut off at the edges ${at}`).toEqual([]);
    expect.soft(defects.overlaps, `drawn one over the other ${at}`).toEqual([]);
  }
}

const PAGES = [
  { name: "the home", path: "/", ready: "Aprende la ley de la gravitación" },
  { name: "the gallery", path: "/galeria", ready: "busca tu propia órbita" },
  {
    name: "a detail",
    path: "/galeria/figura-de-ocho",
    ready: "Figura de ocho",
  },
  {
    name: "the finder",
    path: "/galeria/buscar",
    ready: "Busca tu propia órbita",
  },
];

test.describe(
  "the layout holds from a phone to a desktop",
  crossBrowser,
  () => {
    test.use({ reducedMotion: "reduce" });

    for (const { name, path, ready } of PAGES) {
      test(`on ${name}`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByText(ready).first()).toBeVisible();

        await expectSoundLayout(page);
      });
    }

    test("on Atomy's presentation of the lesson", async ({ page }) => {
      await page.goto("/ley-gravitacion-universal-newton");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      await expectSoundLayout(page);
    });

    test("on the whole lesson, every experiment resolved", async ({
      page,
      baseURL,
    }) => {
      await skipPresentation(page, baseURL);
      await page.goto("/ley-gravitacion-universal-newton");
      await unrollLesson(page);

      await expectSoundLayout(page);
    });
  },
);
