import { describe, expect, it, vi, type Mock } from "vitest";
import type { z } from "zod";
import { PAGE_TOOLS, type Page } from "@/lib/atomy/client-tools";
import type { SectionId } from "@/lib/lesson/sections";
import {
  WIDGET_STATES,
  type WidgetId,
  type WidgetStateOf,
} from "@/lib/lesson/widgets";

type Widgets = {
  readonly [Id in WidgetId]?: {
    readonly section: SectionId;
    readonly state: WidgetStateOf<Id>;
  };
};

/** A page with these widgets, by section, and the reader on `visible`. */
function fakePage(
  widgets: Widgets,
  visible: SectionId | null,
): Page & { sets: Mock<(id: WidgetId, next: unknown) => void> } {
  const sets = vi.fn<(id: WidgetId, next: unknown) => void>();
  const setWidget = <Id extends WidgetId>(id: Id, next: unknown) => {
    sets(id, next);
    const schema: z.ZodType<WidgetStateOf<Id>> = WIDGET_STATES[id];
    return { ok: true as const, state: schema.parse(next) };
  };
  return {
    widget: (id) => widgets[id],
    setWidget,
    sets,
    highlight: () => undefined,
    visibleSection: () => visible,
    goToSection: () => null,
  };
}

describe("set_widget, as the page runs it", () => {
  const widgets: Widgets = {
    ascensor: { section: "distancia", state: { distance: 1 } },
  };

  it("sets a widget of the section the reader is looking at", () => {
    const page = fakePage(widgets, "distancia");

    const result = PAGE_TOOLS.set_widget.run(page, {
      widget: "ascensor",
      distance: 2,
    });

    expect(result).toEqual({
      ok: true,
      output: { widget: "ascensor", distance: 2 },
    });
  });

  it("answers the model with an error for a widget of another section, without changing it", () => {
    // The reader scrolled away while the answer arrived.
    const page = fakePage(widgets, "cualquiera");

    const result = PAGE_TOOLS.set_widget.run(page, {
      widget: "ascensor",
      distance: 2,
    });

    expect(result).toEqual({
      ok: false,
      error:
        'The widget "ascensor" is in the section "distancia", and the reader is now looking at "cualquiera": it can only change the visible section\'s widgets.',
    });
    expect(page.sets).not.toHaveBeenCalled();
  });
});
