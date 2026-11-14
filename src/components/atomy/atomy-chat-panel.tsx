"use client";

// The panel of the chat with Atomy (atomy-chat.tsx), with the conversation:
// the reader's questions go to the language model through the surface's
// route handler, which streams the answer. Each question carries the
// surface's snapshot. The answers are shown as plain text.
// On a phone the panel is a sheet at the bottom of the screen; from xl on,
// where the lesson's column leaves room, it stands beside the text, below
// the sticky header (48 px), whose switch of the mode stays in reach. Atomy,
// in the corner button and in the panel, talks while an answer arrives and
// stops if it fails.
// What goes wrong is said in the reader's words, with what they can do:
// retry, or go on reading. An answer the reader stops keeps its text so far.
// Each finished answer, or its failure, is announced once in a polite live
// region; the fragments are not, and focus stays where the reader left it.
// Atomy also operates the page: the model calls the tools of the page, which
// useAtomyConversation runs through the surface and sends back by itself, up
// to MAX_AUTOMATIC_RESENDS times per question. This component only paints
// the conversation. Each change gets a line in the conversation, written
// from the page's state, a highlight on the widget and an announcement in a
// polite live region of its own. Moving to a section takes focus to its
// title, as the reader asked Atomy to.
// Each page loads it on its own (lesson-chat.tsx, finder-app.tsx) only in
// the advanced mode: with it come the AI SDK and the page's tools. A failed
// answer asks again whether the model can be reached
// (components/shared/atomy-mode.tsx), which may turn the app to the reduced
// mode.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement,
} from "react";
import { Atomy } from "@/components/atomy/atomy";
import { PANEL_ID, type ChatPanelProps } from "@/components/atomy/atomy-chat";
import { FAILURE_TEXT, RATE_LIMIT_TEXT } from "@/components/atomy/chat-outcome";
import type { ChatSurface } from "@/components/atomy/chat-surface";
import {
  useAtomyConversation,
  type ExperimentContext,
} from "@/components/atomy/use-atomy-conversation";
import { useAtomyMode } from "@/components/shared/atomy-mode";

const THINKING = "Atomy está pensando…";

export function AtomyChatPanel({
  surfaceFor,
  open,
  setOpen,
  dockRef,
  connect,
  onShellView,
}: ChatPanelProps & {
  /**
   * The page the chat talks about and operates, with the experiment the
   * conversation is about; its endpoint is read once, when the chat mounts.
   */
  surfaceFor: (context: ExperimentContext | undefined) => ChatSurface;
}): ReactElement {
  const [draft, setDraft] = useState("");
  const {
    messages,
    outcome,
    atomyState,
    thinking,
    announcement,
    context,
    busy,
    lastAction,
    send,
    retry,
    stop,
    openWith,
    reset,
  } = useAtomyConversation(surfaceFor);
  const inputRef = useRef<HTMLInputElement>(null);
  const { recheck } = useAtomyMode();
  useEffect(() => {
    if (outcome === "failed") recheck();
  }, [outcome, recheck]);

  // Before the paint, so the shell never shows a stale Atomy.
  useLayoutEffect(() => {
    onShellView({ atomyState, lastAction });
  }, [atomyState, lastAction, onShellView]);

  // The chat opens with an experiment through the shell, which may have
  // been asked before this panel loaded.
  const openWithRef = useRef(openWith);
  useLayoutEffect(() => {
    openWithRef.current = openWith;
  });
  useEffect(() => {
    connect((next) => {
      openWithRef.current(next);
    });
    return () => {
      connect(null);
    };
  }, [connect]);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (send(draft)) setDraft("");
  }

  /** Asks the last question again; its button goes, so focus goes to the question. */
  function retryQuestion() {
    if (retry()) inputRef.current?.focus();
  }

  /** Empties the conversation; its button goes, so focus goes to the question. */
  function startNewConversation() {
    reset();
    inputRef.current?.focus();
  }

  /** Closes the chat; focus goes back to the button that opens it. */
  function keepReading() {
    setOpen(false);
    dockRef.current?.focus();
  }

  return (
    <>
      {open && (
        <section
          id={PANEL_ID}
          aria-label="Chat con Atomy"
          className="fixed inset-x-0 bottom-0 z-40 flex max-h-[70vh] flex-col rounded-t-2xl border border-violet-300 bg-white shadow-xl xl:inset-x-auto xl:top-16 xl:right-4 xl:bottom-24 xl:max-h-none xl:w-80 xl:rounded-2xl dark:border-violet-800 dark:bg-slate-900"
        >
          <header className="flex items-start justify-between gap-2 border-b border-violet-200 p-3 dark:border-violet-900">
            <div className="flex items-start gap-2">
              <Atomy state={atomyState} className="h-10 w-10 shrink-0" />
              <div>
                <p className="font-semibold">Atomy</p>
                {context && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Sobre: {context.question}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-1">
              {/* The greeting alone is no conversation to empty. */}
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={startNewConversation}
                  className="rounded border border-violet-400 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:border-violet-600 dark:text-violet-200"
                >
                  Nueva conversación
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                }}
                className="rounded px-2 text-sm"
                aria-label="Cerrar el chat"
              >
                ✕
              </button>
            </div>
          </header>
          <ol className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {messages.map((message) => (
              <li
                key={message.key}
                className={`whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                  message.from === "atomy"
                    ? "mr-6 bg-violet-50 dark:bg-violet-950/60"
                    : "ml-6 bg-slate-100 dark:bg-slate-800"
                }`}
              >
                {message.segments.map((segment, index) =>
                  segment.kind === "text" ? (
                    segment.text
                  ) : (
                    <p
                      // Segments only grow at the end while the answer arrives.
                      key={index}
                      className="my-1 text-xs font-semibold text-violet-800 dark:text-violet-200"
                    >
                      {segment.text}
                    </p>
                  ),
                )}
                {message.note && (
                  <p className="mt-1 text-xs font-semibold text-slate-700 italic dark:text-slate-300">
                    {message.note}
                  </p>
                )}
              </li>
            ))}
            {thinking && (
              <li className="mr-6 rounded-2xl bg-violet-50 px-3 py-2 text-slate-700 italic dark:bg-violet-950/60 dark:text-slate-300">
                {THINKING}
              </li>
            )}
            {(outcome === "failed" || outcome === "rate-limit") && (
              <li className="mr-6 rounded-2xl border border-amber-600 bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                <p>{outcome === "failed" ? FAILURE_TEXT : RATE_LIMIT_TEXT}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {outcome === "failed" && (
                    <button
                      type="button"
                      onClick={retryQuestion}
                      className="rounded bg-violet-700 px-3 py-1 text-sm font-semibold text-white"
                    >
                      Reintentar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={keepReading}
                    className="rounded border border-violet-700 px-3 py-1 text-sm font-semibold text-violet-800 dark:border-violet-500 dark:text-violet-200"
                  >
                    Seguir leyendo
                  </button>
                </div>
              </li>
            )}
          </ol>
          <p role="status" className="sr-only">
            {announcement}
          </p>
          <form
            onSubmit={(event) => {
              submit(event);
            }}
            className="flex gap-2 border-t border-violet-200 p-3 dark:border-violet-900"
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              aria-label="Tu pregunta"
              placeholder="Escribe tu duda…"
              className="min-w-0 flex-1 rounded border border-slate-500 px-2 py-1 text-sm placeholder:text-slate-500 dark:border-slate-400 dark:bg-slate-800 dark:placeholder:text-slate-400"
            />
            {/* One button that sends and, while the answer arrives, stops it:
                the reader's focus stays on it either way. */}
            <button
              type={busy ? "button" : "submit"}
              onClick={
                busy
                  ? () => {
                      stop();
                    }
                  : undefined
              }
              aria-label={busy ? "Detener la respuesta" : undefined}
              className="rounded bg-violet-700 px-3 py-1 text-sm font-semibold text-white"
            >
              {busy ? "Detener" : "Enviar"}
            </button>
          </form>
        </section>
      )}
    </>
  );
}
