"use client";

// The registry of the lesson's widgets that can be driven from outside the
// reader's hands (Atomy's client tools). Each widget registers under its id
// from lib/atomy/lesson-widgets, in its section, with its current state and a
// function that sets a new state after validating it against that id's
// schema. Callers reach the widgets only through this registry, never
// through the DOM, and get each one's state with its type.
// The registry holds no state of its own: each widget keeps its state in the
// lesson's progress with useWidgetState (lesson/lesson-widget), and the
// registry reads it and sets it through the widget.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { z } from "zod";
import { useLessonSection } from "@/components/learn/lesson/lesson-section";
import type { SectionId } from "@/lib/lesson/sections";
import {
  WIDGET_IDS,
  WIDGET_SECTIONS,
  WIDGET_STATES,
  widgetChangeFrom,
  type WidgetChange,
  type WidgetId,
  type WidgetStateOf,
} from "@/lib/lesson/widgets";

export type SetResult<State> =
  | { readonly ok: true; readonly state: State }
  | { readonly ok: false; readonly error: string };

/** A registered widget: its section and its current state. */
export interface WidgetOnPage<Id extends WidgetId> {
  readonly section: SectionId;
  readonly state: WidgetStateOf<Id>;
}

export interface LessonController {
  /** Validates `next` and, if valid, applies it as the reader would. */
  readonly setWidget: <Id extends WidgetId>(
    id: Id,
    next: unknown,
  ) => SetResult<WidgetStateOf<Id>>;
  /** The widgets of `section`, as set_widget's changes. */
  readonly snapshot: (section: SectionId) => WidgetChange[];
  /** One widget, wherever it is, or undefined while it is not on the page. */
  readonly widget: <Id extends WidgetId>(
    id: Id,
  ) => WidgetOnPage<Id> | undefined;
  /** Highlights a widget for HIGHLIGHT_MS, to show where something changed. */
  readonly highlight: (id: WidgetId) => void;
}

/** How long a widget stays highlighted after a change from outside. */
export const HIGHLIGHT_MS = 2000;

/**
 * The classes of a highlighted widget: a ring, drawn as an outline, that pulses
 * with motion allowed and stays still with reduced motion. Only the outline
 * pulses (outline-pulse in app/globals.css), so the content keeps its contrast.
 */
export const HIGHLIGHT_CLASS =
  "rounded-xl outline-4 outline-offset-4 outline-violet-400 motion-safe:animate-outline-pulse dark:outline-violet-500";

interface Registration<Id extends WidgetId> extends WidgetOnPage<Id> {
  readonly set: (next: unknown) => SetResult<WidgetStateOf<Id>>;
  readonly highlight: () => void;
}

type Registrations = Slots<WidgetId>;

interface Registry extends LessonController {
  readonly register: <Id extends WidgetId>(
    id: Id,
    widget: Registration<Id>,
  ) => () => void;
}

const RegistryContext = createContext<Registry | null>(null);

/**
 * The registrations seen through the ids in `Id`: indexed by an `Id`, a slot
 * is that id's registration for reads and writes alike, so a write is checked
 * against the registration of the id it is written under.
 */
type Slots<Id extends WidgetId> = {
  [Slot in Id]?: Registration<Slot> | undefined;
};

/** Sets the registration of `id`, or clears it with undefined. */
function put<Id extends WidgetId>(
  slots: NoInfer<Slots<Id>>,
  id: Id,
  widget: NoInfer<Registration<Id>> | undefined,
): void {
  slots[id] = widget;
}

/** The widget `id`'s state as set_widget's change, when it is in `section`. */
function changeOf<Id extends WidgetId>(
  slots: NoInfer<Slots<Id>>,
  id: Id,
  section: SectionId,
): WidgetChange[] {
  const widget = slots[id];
  return widget?.section === section
    ? [widgetChangeFrom(id, widget.state)]
    : [];
}

function createRegistry(): Registry {
  const widgets: Registrations = {};
  return {
    register(id, widget) {
      put(widgets, id, widget);
      return () => {
        if (widgets[id] === widget) put(widgets, id, undefined);
      };
    },
    setWidget(id, next) {
      const widget = widgets[id];
      if (widget === undefined)
        return { ok: false, error: `No widget with id "${id}"` };
      return widget.set(next);
    },
    snapshot(section) {
      return WIDGET_IDS.flatMap((id) => changeOf(widgets, id, section));
    },
    widget(id) {
      const widget = widgets[id];
      return widget === undefined
        ? undefined
        : { section: widget.section, state: widget.state };
    },
    highlight(id) {
      widgets[id]?.highlight();
    },
  };
}

export function LessonControllerProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [registry] = useState(createRegistry);
  return (
    <RegistryContext.Provider value={registry}>
      {children}
    </RegistryContext.Provider>
  );
}

/** The registry, or null outside a provider, where there are no widgets to drive. */
export function useOptionalLessonController(): LessonController | null {
  return useContext(RegistryContext);
}

function describeError(error: z.ZodError): string {
  return error.issues
    .map((issue) =>
      issue.path.length > 0
        ? `${issue.path.join(".")} ${issue.message}`
        : issue.message,
    )
    .join("; ");
}

/** The props of the widget's outer element, with its highlight when it has one. */
export type WidgetFrame = (className: string) => {
  className: string;
  "data-highlighted"?: "";
};

export function frameOf(highlighted: boolean): WidgetFrame {
  return (className) =>
    highlighted
      ? { className: `${className} ${HIGHLIGHT_CLASS}`, "data-highlighted": "" }
      : { className };
}

/**
 * Registers the widget `id`, in the section WIDGET_SECTIONS gives it, while
 * it is mounted, with its latest `state`; `apply` sets a state already
 * validated against the id's schema, as the reader's own controls would.
 * Outside the lesson's sections or outside a provider it does nothing, so
 * the widget works on its own. In development it warns when the section
 * around it on the page is not its own. Returns the props of the widget's
 * outer element, with its highlight while it is highlighted.
 */
export function useRegisterWidget<Id extends WidgetId>(
  id: Id,
  state: WidgetStateOf<Id>,
  apply: (next: WidgetStateOf<Id>) => void,
): WidgetFrame {
  const registry = useContext(RegistryContext);
  const onPage = useLessonSection();
  const section = WIDGET_SECTIONS[id];
  const schema: z.ZodType<WidgetStateOf<Id>> = WIDGET_STATES[id];
  const [highlighted, setHighlighted] = useState(false);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const highlight = () => {
    clearTimeout(highlightTimer.current);
    setHighlighted(true);
    highlightTimer.current = setTimeout(() => {
      setHighlighted(false);
    }, HIGHLIGHT_MS);
  };
  useEffect(
    () => () => {
      clearTimeout(highlightTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      onPage !== undefined &&
      onPage !== section
    )
      console.warn(
        `The widget "${id}" is in the section "${onPage}", but belongs in "${section}".`,
      );
  }, [id, section, onPage]);
  const applyRef = useRef(apply);
  // The state as last set: a change from outside is seen at once, before
  // the widget renders it, so a snapshot taken right after already has it.
  const stateRef = useRef(state);
  const highlightRef = useRef(highlight);
  useEffect(() => {
    applyRef.current = apply;
    highlightRef.current = highlight;
  });
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const inLesson = onPage !== undefined;
  useEffect(() => {
    if (registry === null || !inLesson) return;
    return registry.register(id, {
      section,
      get state() {
        return stateRef.current;
      },
      set(next) {
        const result = schema.safeParse(next);
        if (!result.success)
          return { ok: false, error: describeError(result.error) };
        applyRef.current(result.data);
        stateRef.current = result.data;
        return { ok: true, state: result.data };
      },
      highlight: () => {
        highlightRef.current();
      },
    });
  }, [registry, inLesson, id, section, schema]);
  return frameOf(highlighted);
}
