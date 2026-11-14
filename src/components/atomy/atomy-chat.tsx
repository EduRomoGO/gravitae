"use client";

// The chat with Atomy of the advanced mode, on any surface. It opens from
// Atomy's corner button, with no context, or from the Atomy of an
// experiment, with that experiment's question as context.
// This module is the chat's shell: the corner button, whether the panel is
// open and the way to open it. The panel, with the conversation, the AI SDK
// and the page's tools, is a separate chunk that each page loads only in the
// advanced mode (atomy-chat-panel.tsx): in the reduced mode none of it reaches
// the browser. The page passes its panel: the lesson
// (learn/atomy/lesson-chat.tsx) and the orbit finder
// (gallery/finder/finder-app.tsx). The corner button stays in the shell, so
// it is there in the same render that turns the mode on (the lesson's
// presentation flies Atomy to it) while the panel's chunk arrives.
// The conversation, the experiment it is about and whether the panel is
// open are part of the reader's progress (shared/progress.tsx), where the
// page has one: a reload shows them as they were after the last finished
// answer. Without a progress, as on the finder, the conversation lasts as
// long as the page. "Nueva conversación" empties it, and each question
// carries only the latest messages (chat-window.ts), so a long conversation
// keeps working.
// Outside the advanced mode (`enabled` false) it only wraps its children:
// no button, no panel, and useOpenChat gives null; the conversation waits
// for the mode to come back.

import {
  createContext,
  Suspense,
  useContext,
  useRef,
  useState,
  type ComponentType,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { z } from "zod";
import { Atomy, type AtomyState } from "@/components/atomy/atomy";
import type { ExperimentContext } from "@/components/atomy/use-atomy-conversation";
import { usePersistentState } from "@/components/shared/progress";

export const PANEL_ID = "atomy-chat";
const OPEN_KEY = "chat-abierto";
const openSchema = z.boolean();

/** Opens the chat; `context` is the experiment the reader asks about. */
type OpenChat = (context?: ExperimentContext) => void;

/** Takes the experiment the chat opens with into the conversation. */
type OpenWith = (context: ExperimentContext | undefined) => void;

const ChatContext = createContext<OpenChat | null>(null);

/** Null outside the advanced mode, where there is no chat. */
export function useOpenChat(): OpenChat | null {
  return useContext(ChatContext);
}

/** What the shell shows of the conversation, which the panel holds. */
export interface ShellView {
  /** Atomy's state, for the corner button. */
  readonly atomyState: AtomyState;
  /** The last change Atomy made on the page, announced. */
  readonly lastAction: string;
}

const NO_VIEW: ShellView = { atomyState: "idle", lastAction: "" };

/** What the shell gives the panel. */
export interface ChatPanelProps {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  /** The corner button, where focus goes back when the panel closes. */
  readonly dockRef: RefObject<HTMLButtonElement | null>;
  /** The panel's conversation takes the chat's openings; null when it goes. */
  readonly connect: (openWith: OpenWith | null) => void;
  /** What the shell shows of the conversation, around the page. */
  readonly onShellView: (view: ShellView) => void;
}

/**
 * The link between the shell and the panel: an opening asked before the
 * panel's chunk arrives waits for it.
 */
class PanelLink {
  #openWith: OpenWith | null = null;
  #pending: { readonly context: ExperimentContext | undefined } | null = null;

  readonly connect = (openWith: OpenWith | null): void => {
    this.#openWith = openWith;
    const pending = this.#pending;
    if (openWith === null || pending === null) return;
    this.#pending = null;
    openWith(pending.context);
  };

  openWith(context: ExperimentContext | undefined): void {
    if (this.#openWith) this.#openWith(context);
    else this.#pending = { context };
  }
}

export function AtomyChat({
  children,
  panel: Panel,
  enabled = true,
}: {
  children: ReactNode;
  /** The page's panel, loaded on its own (next/dynamic). */
  panel: ComponentType<ChatPanelProps>;
  /** The advanced mode is on: the chat shows. */
  enabled?: boolean;
}): ReactElement {
  const [open, updateOpen] = usePersistentState(OPEN_KEY, false, openSchema);
  const setOpen = (next: boolean) => {
    updateOpen(() => next);
  };
  // Idle and silent until the panel arrives and tells its own.
  const [view, setView] = useState(NO_VIEW);
  const [link] = useState(() => new PanelLink());
  const dockRef = useRef<HTMLButtonElement>(null);

  const openChat: OpenChat = (next) => {
    link.openWith(next);
    setOpen(true);
  };

  return (
    <ChatContext.Provider value={enabled ? openChat : null}>
      {/* Outside the panel: Atomy's actions are announced even while it is
          closed. Before the page, so it adds nothing below its last line. */}
      {enabled && (
        <p role="status" aria-label="Lo que hace Atomy" className="sr-only">
          {view.lastAction}
        </p>
      )}
      {children}
      {enabled && (
        <>
          {/* Room for the corner button below the page's last line. */}
          <div aria-hidden="true" className="h-20" />
          <button
            ref={dockRef}
            id="atomy-dock"
            type="button"
            aria-label="Pregúntale a Atomy"
            aria-expanded={open}
            aria-controls={open ? PANEL_ID : undefined}
            onClick={() => {
              setOpen(!open);
            }}
            className="fixed right-4 bottom-4 z-40 h-16 w-16 rounded-full bg-violet-50 p-1 shadow-lg ring-2 ring-violet-300 dark:bg-violet-950 dark:ring-violet-800"
          >
            <Atomy state={view.atomyState} className="h-full w-full" />
          </button>
          {/* Its own boundary: while the panel's chunk arrives, the page
              around it stays as it is. */}
          <Suspense fallback={null}>
            <Panel
              open={open}
              setOpen={setOpen}
              dockRef={dockRef}
              connect={link.connect}
              onShellView={setView}
            />
          </Suspense>
        </>
      )}
    </ChatContext.Provider>
  );
}
