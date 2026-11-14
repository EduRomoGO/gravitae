import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// axe leaves "incomplete", not violated, every text whose background it cannot
// resolve. The body's glow is a radial-gradient (src/app/globals.css), and the
// translucent header lets it through, so without help axe skips the contrast
// of almost every text on the page and the tests pass with failures present.

/**
 * The reasons axe may leave a text's contrast undecided without failing the
 * test: text behind an image and characters outside the Basic Multilingual
 * Plane (emoji, drawn in color). The text inside an SVG is left out whatever
 * the reason: tests/e2e/svg-text-contrast.spec.ts checks it.
 */
const ACCEPTED_INCOMPLETE = new Set(["imgNode", "nonBmp"]);

/** The opening tag of an SVG text, as axe reports a node's `html`. */
const SVG_TEXT = /^<(text|tspan|textPath)[\s>]/;

/**
 * Paints the body with its solid background, without the glow, and the sticky
 * header with the same color: at 90 % opacity it lets the content scrolled
 * under it through, and axe leaves its links undecided
 * (`elmPartiallyObscured`). The page's background is darker than the header's
 * white in the light theme and lighter than its near black in the dark one, so
 * the header's text is checked against a background no better than its own.
 */
const SOLID_BACKGROUNDS = `
  body { background: var(--background) !important; }
  header.sticky { background: var(--background) !important; }
`;

type Configure = (builder: AxeBuilder) => AxeBuilder;

export interface AxeOutcome {
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"];
  /** The texts whose contrast axe left undecided for a reason not accepted. */
  undecidedContrast: { target: string; reasons: string[] }[];
}

/**
 * Runs axe on `page` with the body's background solid, so the contrast of the
 * text over the body is decided against the color the glow fades into.
 */
export async function analyzeAxe(
  page: Page,
  configure: Configure = (builder) => builder,
): Promise<AxeOutcome> {
  const style = await page.addStyleTag({ content: SOLID_BACKGROUNDS });
  try {
    const results = await configure(new AxeBuilder({ page })).analyze();
    const contrast = results.incomplete.find(
      (rule) => rule.id === "color-contrast",
    );
    const undecidedContrast = (contrast?.nodes ?? [])
      .map((node) => ({
        target: node.target.join(" "),
        html: node.html,
        reasons: [...node.any, ...node.all, ...node.none]
          .map((check) => messageKeyOf(check.data))
          .filter((key) => key !== undefined),
      }))
      .filter(
        ({ html, reasons }) =>
          !SVG_TEXT.test(html) &&
          reasons.some((reason) => !ACCEPTED_INCOMPLETE.has(reason)),
      )
      .map(({ target, reasons }) => ({ target, reasons }));
    return { violations: results.violations, undecidedContrast };
  } finally {
    await style.evaluate((element) => {
      if (element instanceof Element) element.remove();
    });
  }
}

/** Expects no axe violations and no text with its contrast undecided. */
export async function expectNoAxeViolations(
  page: Page,
  configure?: Configure,
): Promise<void> {
  const { violations, undecidedContrast } = await analyzeAxe(page, configure);
  expect(violations).toEqual([]);
  expect(undecidedContrast).toEqual([]);
}

function messageKeyOf(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  if (!("messageKey" in data)) return undefined;
  return typeof data.messageKey === "string" ? data.messageKey : undefined;
}
