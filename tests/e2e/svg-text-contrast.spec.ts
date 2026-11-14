import { expect, test, type Page } from "@playwright/test";
import { skipPresentation, unrollLesson } from "./lesson";

// axe leaves the text inside an SVG undecided (`imgNode`), so this test checks
// it: the `fill` of each `<text>` against the shapes under its center, at the
// size the drawing's scale gives it on screen (WCAG 2.2, 1.4.3).

interface TextContrast {
  text: string;
  ratio: number;
  minimum: number;
}

/** The contrast of every visible SVG text of the page against its background. */
function svgTextContrasts(page: Page): Promise<TextContrast[]> {
  return page.evaluate(() => {
    type Rgba = [number, number, number, number];

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("No 2D canvas context");

    // Through the canvas, so every CSS color syntax (oklch included) resolves
    // to sRGB.
    function rgba(color: string, opacity = 1): Rgba {
      if (!context) throw new Error("No 2D canvas context");
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "#000";
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(
        0,
        0,
        1,
        1,
      ).data;
      return [r, g, b, (a / 255) * opacity];
    }

    function over(top: Rgba, bottom: Rgba): Rgba {
      const a = top[3] + bottom[3] * (1 - top[3]);
      if (a === 0) return [0, 0, 0, 0];
      const mix = (i: 0 | 1 | 2) =>
        (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a;
      return [mix(0), mix(1), mix(2), a];
    }

    function luminance([r, g, b]: Rgba): number {
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    }

    /** The opacity of `element` times its ancestors' up to the document. */
    function opacityOf(element: Element): number {
      let opacity = 1;
      for (let node: Element | null = element; node; node = node.parentElement)
        opacity *= Number(getComputedStyle(node).opacity);
      return opacity;
    }

    function paintOf(element: Element): Rgba {
      const style = getComputedStyle(element);
      if (
        element instanceof SVGElement &&
        !(element instanceof SVGSVGElement)
      ) {
        const fill =
          style.fill.startsWith("currentcolor") || style.fill === "currentColor"
            ? style.color
            : style.fill;
        if (fill === "none" || fill.startsWith("url(")) return [0, 0, 0, 0];
        return rgba(fill, Number(style.fillOpacity) * opacityOf(element));
      }
      return rgba(style.backgroundColor, opacityOf(element));
    }

    const page = rgba(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--background",
      ),
    );

    const contrasts: TextContrast[] = [];
    for (const text of document.querySelectorAll("svg text")) {
      if (!(text instanceof SVGTextElement)) continue;
      const content = text.textContent.trim();
      if (!content || text.getClientRects().length === 0) continue;
      text.scrollIntoView({ block: "center", inline: "center" });
      const box = text.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;

      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const under = document
        .elementsFromPoint(x, y)
        .filter((element) => element !== text && !text.contains(element));
      let background: Rgba = [0, 0, 0, 0];
      for (const element of under) {
        background = over(background, paintOf(element));
        if (background[3] >= 1) break;
      }
      background = over(background, page);

      const style = getComputedStyle(text);
      const fill = style.fill.startsWith("url(") ? style.color : style.fill;
      const foreground = over(
        rgba(
          fill === "currentcolor" || fill === "currentColor"
            ? style.color
            : fill,
          Number(style.fillOpacity) * opacityOf(text),
        ),
        background,
      );

      const [light, dark] = [luminance(foreground), luminance(background)].sort(
        (a, b) => b - a,
      );
      const ratio = ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
      const scale = text.getScreenCTM()?.a ?? 1;
      const size = Number.parseFloat(style.fontSize) * scale;
      const bold = Number(style.fontWeight) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      contrasts.push({
        text: content,
        ratio: Math.round(ratio * 100) / 100,
        minimum: large ? 3 : 4.5,
      });
    }
    return contrasts;
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`the lesson's SVG texts keep their contrast at ${String(width)} px with the ${colorScheme} color scheme`, async ({
      page,
      baseURL,
    }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await skipPresentation(page, baseURL);
      await page.goto("/ley-gravitacion-universal-newton");
      await unrollLesson(page);

      const contrasts = await svgTextContrasts(page);

      expect(contrasts.length).toBeGreaterThan(0);
      expect(contrasts.filter(({ ratio, minimum }) => ratio < minimum)).toEqual(
        [],
      );
    });
  }
}
