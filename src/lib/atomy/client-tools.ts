// The tools with which Atomy operates the lesson, one entry per tool in
// PAGE_TOOLS: what the model reads of it (description and schemas), when a
// request offers it, how the page runs it and the line the chat writes for
// its result. The widgets' state lives in the reader's browser, so no entry
// has an `execute`: the chat runs `run` in onToolCall through the lesson's
// Page and sends the result back with the next request. The AI SDK validates
// every call against its inputSchema first: an invalid call goes back to the
// model as a tool error and never reaches the page. They only change the
// page: no network, nothing written outside it.

import { tool, type Tool } from "ai";
import { z } from "zod";
import { SECTION_IDS, type SectionId } from "@/lib/lesson/sections";
import type { PageToolResult } from "@/lib/atomy/chat-messages";
import type { ChatSnapshot } from "@/lib/atomy/chat-request";
import {
  actionLineOf,
  surfaceTool,
  type SurfaceTool,
} from "@/lib/atomy/surface-tool";
import {
  describeWidget,
  WIDGET_NAMES,
  widgetChange,
  widgetChangeOf,
  type WidgetChange,
  type WidgetId,
  type WidgetStateOf,
} from "@/lib/lesson/widgets";

/**
 * The automatic resends the chat chains after the page answers its tools,
 * per question of the reader. stopWhen bounds the steps within a request;
 * this bounds the requests of a model that keeps calling tools.
 */
export const MAX_AUTOMATIC_RESENDS = 3;

export const goToSectionInput = z.strictObject({
  section: z.enum(SECTION_IDS).describe("La sección de la lección"),
});

export const goToSectionOutput = z.strictObject({
  section: z.enum(SECTION_IDS),
  title: z.string().min(1).max(200),
});

type GoToSectionOutput = z.infer<typeof goToSectionOutput>;

/**
 * The page as the tools reach it: the lesson controller's widgets, the
 * section the reader is looking at and the move to a section. The chat
 * builds it from the lesson controller and the document.
 */
export interface Page {
  /** A registered widget, or undefined while it is not on the page. */
  readonly widget: <Id extends WidgetId>(
    id: Id,
  ) =>
    | { readonly section: SectionId; readonly state: WidgetStateOf<Id> }
    | undefined;
  /** Validates `next` and, if valid, sets the widget as the reader would. */
  readonly setWidget: <Id extends WidgetId>(
    id: Id,
    next: unknown,
  ) =>
    | { readonly ok: true; readonly state: WidgetStateOf<Id> }
    | { readonly ok: false; readonly error: string };
  readonly highlight: (id: WidgetId) => void;
  /** The id of the section the reader is looking at now, if any. */
  readonly visibleSection: () => SectionId | null;
  /**
   * Takes the reader to the section's title, which takes focus. Its title,
   * or null while the section is not shown.
   */
  readonly goToSection: (section: SectionId) => string | null;
}

const SET_WIDGET_DESCRIPTION =
  "Cambia un widget de la sección visible, como si el lector moviera sus controles. Devuelve el widget tal como queda.";

export const PAGE_TOOL_NAMES = ["go_to_section", "set_widget"] as const;

export type PageToolName = (typeof PAGE_TOOL_NAMES)[number];

/** What each tool of the page takes and gives, as the chat's messages carry it. */
export type PageToolTypes = {
  readonly go_to_section: {
    readonly input: z.infer<typeof goToSectionInput>;
    readonly output: GoToSectionOutput;
  };
  readonly set_widget: {
    readonly input: WidgetChange;
    readonly output: WidgetChange;
  };
};

/** A tool of the lesson, with whether a request offers it. */
type PageTool<Input, Output> = SurfaceTool<
  Page,
  Input,
  Output,
  PageToolResult<Output>
> & {
  /** Whether a request with this snapshot offers the tool. */
  readonly offered: (snapshot: ChatSnapshot) => boolean;
};

/**
 * The tools of the page, each typed by its name, so a call of any of them
 * runs as `PAGE_TOOLS[name].run(page, input)`.
 */
export const PAGE_TOOLS: {
  readonly [Name in PageToolName]: PageTool<
    PageToolTypes[Name]["input"],
    PageToolTypes[Name]["output"]
  >;
} = {
  go_to_section: {
    ...surfaceTool({
      description:
        "Lleva al lector a una sección de la lección que ya se le ha mostrado: la página se desplaza hasta su título.",
      inputSchema: goToSectionInput,
      outputSchema: goToSectionOutput,
      run: (page: Page, { section }): PageToolResult<GoToSectionOutput> => {
        const title = page.goToSection(section);
        return title === null
          ? {
              ok: false,
              error: `The section "${section}" is not shown yet: the reader has not reached it.`,
            }
          : { ok: true, output: { section, title: title || section } };
      },
      actionLine: ({ title }) => `Atomy te llevó a la sección «${title}».`,
    }),
    offered: () => true,
  },
  set_widget: {
    ...surfaceTool({
      description: SET_WIDGET_DESCRIPTION,
      inputSchema: widgetChange,
      outputSchema: widgetChange,
      run: (page: Page, { widget, ...state }): PageToolResult<WidgetChange> => {
        const registered = page.widget(widget);
        if (registered === undefined)
          return {
            ok: false,
            error: `The widget "${widget}" is not on the page yet: the reader has not reached it.`,
          };
        // The request offered the widgets of the section visible when it left;
        // the reader may have scrolled since.
        const visible = page.visibleSection();
        if (registered.section !== visible)
          return {
            ok: false,
            error: `The widget "${widget}" is in the section "${registered.section}", and the reader is now looking at "${String(visible)}": it can only change the visible section's widgets.`,
          };
        const result = page.setWidget(widget, state);
        if (!result.ok) return result;
        const output = widgetChange.parse({ ...result.state, widget });
        page.highlight(widget);
        return { ok: true, output };
      },
      actionLine: (change) =>
        `Atomy puso ${WIDGET_NAMES[change.widget]} ${describeWidget(change)}.`,
    }),
    offered: ({ widgets }) => widgets.length > 0,
  },
};

/** The type of a tool of the page's part in a message. */
export type PageToolPartType = `tool-${PageToolName}`;

export const PAGE_TOOL_PART_TYPES: readonly PageToolPartType[] =
  PAGE_TOOL_NAMES.map((name): PageToolPartType => `tool-${name}`);

/** The tools of the page a request with this snapshot offers. */
export function offeredPageTools(snapshot: ChatSnapshot): PageToolName[] {
  return PAGE_TOOL_NAMES.filter((name) => PAGE_TOOLS[name].offered(snapshot));
}

/** The line the chat writes for a tool of the page that changed the page. */
export const actionLine = actionLineOf(PAGE_TOOLS, PAGE_TOOL_NAMES);

/**
 * set_widget restricted to the visible section: only its
 * widgets on the page. Undefined where the section has none.
 */
export function sectionTools(widgets: readonly WidgetId[]): {
  set_widget?: Tool<WidgetChange, WidgetChange>;
} {
  const widgetInput = widgetChangeOf(widgets);
  return widgetInput
    ? {
        set_widget: tool({
          description: SET_WIDGET_DESCRIPTION,
          inputSchema: widgetInput,
          outputSchema: widgetChange,
        }),
      }
    : {};
}
