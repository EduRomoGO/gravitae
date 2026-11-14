"use client";

// The lesson opens with Atomy alone: it presents itself and asks whether the
// reader wants to start. Either answer gets a short reply, which waits for
// the reader to click «Entendido»; then the lesson appears and Atomy flies to
// where it goes on:
// - reduced mode: into the first experiment, where it asks the first question;
//   it does not fly again.
// - advanced mode: to the bottom right corner, the button that opens the
//   chat.
// Once seen (cookie), the lesson opens directly. The mode is the app's
// (components/shared/atomy-mode.tsx): the header's switch, off by default,
// and the reduced mode while the model is out of reach. A change of mode, the
// reader's or a lost connection, keeps the reader where they are: the chat
// and the reasoning's correction come and go around the same lesson.
// In development only, a bar on top of the lesson, marked as a prototype,
// replays the presentation and shows the whole lesson at once (?todo); the
// production build leaves it out.
// The reader's progress is one for both modes (shared/progress.tsx), so a
// reload goes on where the reader was; watching the presentation again
// keeps it. What only the advanced mode uses, such as the reasoning and its
// correction, stays in it while the reduced mode ignores it.
// Until the progress is restored, the lesson stays hidden (restoring-veil.ts).
// «Empezar de nuevo», for the reader, asks for confirmation and then forgets
// the progress of both modes and that the reader met Atomy: the lesson starts
// over from the presentation.

import Link from "next/link";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { Atomy, useTalkThenIdle } from "@/components/atomy/atomy";
import { prefersReducedMotion } from "@/lib/reduced-motion";
import { useAdvancedMode } from "@/components/shared/atomy-mode";
import {
  forgetAtomyIntro,
  markAtomyIntroSeen,
} from "@/components/atomy/atomy-cookie";
import { LessonChat } from "@/components/learn/atomy/lesson-chat";
import { LessonControllerProvider } from "@/components/learn/lesson-controller";
import { ProgressProvider } from "@/components/shared/progress";
import { InlineScript } from "@/components/shared/inline-script";
import {
  clearLessonProgress,
  createProgressStore,
  progressStorageKey,
} from "@/lib/progress/progress-store";
import { restoringVeilScript } from "@/lib/progress/restoring-veil";
import type { ServerMode } from "@/lib/atomy/server-mode";
import { LESSON_PATH } from "@/lib/routes";

const DEV_TOOLS = process.env.NODE_ENV !== "production";
/** The lesson's name in the progress kept in the browser. */
const LESSON = "ley-gravitacion-universal-newton";
const FLIGHT_MS = 900;
/** How long Atomy talks its greeting and its reply. */
const GREETING_MS = 4000;
const REPLY_MS = 1800;
const ANSWERS = ["Sí", "¡Claro que sí!"] as const;
const UNDERSTOOD = "Entendido";
/** The page's heading while Atomy presents itself, before the lesson's own. */
const PRESENTATION_HEADING =
  "Aprende la ley de la gravitación universal de Newton";

type Phase = "presenting" | "replying" | "started";

export function AtomyLessonGate({
  greeted,
  serverMode,
  showAll = false,
  children,
}: {
  greeted: boolean;
  /** The mode as the server read it for this request. */
  serverMode: ServerMode;
  /** The whole lesson is shown at once (?todo, development only). */
  showAll?: boolean;
  children: ReactNode;
}): ReactElement {
  const advanced = useAdvancedMode(serverMode);
  const [phase, setPhase] = useState<Phase>(greeted ? "started" : "presenting");
  const storageKey = progressStorageKey(LESSON);
  const [store] = useState(() => createProgressStore(storageKey));
  // Only a page that opens on the lesson goes back to the reader's section.
  const [restoreScroll, setRestoreScroll] = useState(greeted);
  const avatarRef = useRef<HTMLDivElement>(null);
  // Where the presenting Atomy was when it finished its reply.
  const flightFrom = useRef<DOMRect | null>(null);

  useLayoutEffect(() => {
    const from = flightFrom.current;
    flightFrom.current = null;
    if (phase !== "started" || !from || prefersReducedMotion()) return;
    const target = advanced
      ? document.getElementById("atomy-dock")
      : document.querySelector<HTMLElement>("main [data-atomy-avatar]");
    if (!target) return;
    if (!advanced) target.scrollIntoView({ block: "center" });
    flyFromTo(from, target);
  }, [phase, advanced]);

  if (phase !== "started") {
    return (
      <Presentation
        avatarRef={avatarRef}
        advanced={advanced}
        replying={phase === "replying"}
        onAnswer={() => {
          setPhase("replying");
        }}
        onUnderstood={() => {
          markAtomyIntroSeen();
          setRestoreScroll(false);
          flightFrom.current =
            avatarRef.current?.getBoundingClientRect() ?? null;
          setPhase("started");
        }}
      />
    );
  }
  const lesson = (
    <>
      {DEV_TOOLS && (
        <PrototypeBar
          advanced={advanced}
          showAll={showAll}
          onReplay={() => {
            setRestoreScroll(false);
            setPhase("presenting");
            window.scrollTo({ top: 0 });
          }}
        />
      )}
      <RestartLesson
        advanced={advanced}
        onRestart={() => {
          store.clear();
          clearLessonProgress(LESSON);
          forgetAtomyIntro();
          setRestoreScroll(false);
          setPhase("presenting");
          window.scrollTo({ top: 0 });
        }}
      />
      {children}
    </>
  );
  // The chat drives the lesson's widgets through the controller. It wraps
  // the lesson in both modes, so a change of mode keeps the lesson mounted.
  return (
    <ProgressProvider store={store} restoreScroll={restoreScroll}>
      {restoreScroll && <InlineScript code={restoringVeilScript(storageKey)} />}
      <LessonControllerProvider>
        <LessonChat enabled={advanced}>{lesson}</LessonChat>
      </LessonControllerProvider>
    </ProgressProvider>
  );
}

/** FLIP: the target starts where the presenting Atomy was and lands in place. */
function flyFromTo(from: DOMRect, target: HTMLElement) {
  const to = target.getBoundingClientRect();
  const { position, zIndex } = target.style;
  if (getComputedStyle(target).position === "static") {
    target.style.position = "relative";
  }
  target.style.zIndex = "50";
  const flight = target.animate(
    [
      {
        transformOrigin: "top left",
        transform: `translate(${String(from.left - to.left)}px, ${String(from.top - to.top)}px) scale(${String(from.width / to.width)})`,
      },
      { transformOrigin: "top left", transform: "translate(0, 0) scale(1)" },
    ],
    { duration: FLIGHT_MS, easing: "cubic-bezier(0.5, 0, 0.3, 1)" },
  );
  flight.onfinish = () => {
    target.style.position = position;
    target.style.zIndex = zIndex;
  };
}

const ANSWER_CLASS =
  "rounded-full bg-violet-700 px-5 py-2 font-semibold text-white";

function Presentation({
  avatarRef,
  advanced,
  replying,
  onAnswer,
  onUnderstood,
}: {
  avatarRef: RefObject<HTMLDivElement | null>;
  advanced: boolean;
  replying: boolean;
  onAnswer: () => void;
  onUnderstood: () => void;
}): ReactElement {
  // The reply starts a new turn: Atomy talks it, then idles while it waits.
  const talk = useTalkThenIdle(replying ? REPLY_MS : GREETING_MS, replying);
  return (
    <section
      aria-label="Atomy se presenta"
      className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:items-start"
    >
      <h1 className="sr-only">{PRESENTATION_HEADING}</h1>
      <div ref={avatarRef} className="h-40 w-40 shrink-0">
        <Atomy state={talk} className="h-40 w-40" />
      </div>
      <div className="space-y-4">
        <div
          role="status"
          className="rounded-2xl border border-violet-300 bg-violet-50 p-4 leading-relaxed sm:rounded-tl-none dark:border-violet-800 dark:bg-violet-950/40"
        >
          {replying ? (
            <p className="text-lg font-semibold">
              {advanced
                ? "Puedes encontrarme en cada experimento o en la esquina inferior derecha."
                : "¡Te veo en el primer experimento!"}
            </p>
          ) : (
            <>
              <p>
                ¡Hola! Soy <strong>Atomy</strong>. Vamos a descubrir juntos,
                experimento a experimento, la ley de la gravitación universal de
                Newton. En cada experimento te haré una pregunta. Tú eliges una
                respuesta y después comprobamos si has acertado.
                {advanced &&
                  " Y si te surge cualquier duda por el camino, ¡pregúntame!"}
              </p>
              <p className="mt-2 text-lg font-semibold">¿Empezamos?</p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {replying ? (
            <button
              // The answer's button is gone: the focus moves on to this one.
              autoFocus
              type="button"
              onClick={onUnderstood}
              className={ANSWER_CLASS}
            >
              {UNDERSTOOD}
            </button>
          ) : (
            ANSWERS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={onAnswer}
                className={ANSWER_CLASS}
              >
                {label}
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

const RESTART_CLASS =
  "rounded border border-slate-500 px-3 py-1 text-sm font-semibold";

/** «Empezar de nuevo», confirmed in place before it forgets anything. */
function RestartLesson({
  advanced,
  onRestart,
}: {
  advanced: boolean;
  onRestart: () => void;
}): ReactElement {
  const [confirming, setConfirming] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const warningId = useId();
  return (
    <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
      {confirming ? (
        <div
          role="group"
          aria-describedby={warningId}
          className="flex flex-wrap items-center justify-end gap-2"
        >
          <p id={warningId} className="text-sm">
            {advanced
              ? "Se borrarán tus respuestas y tu conversación con Atomy. ¿Empezar de nuevo?"
              : "Se borrarán tus respuestas. ¿Empezar de nuevo?"}
          </p>
          <button
            type="button"
            onClick={onRestart}
            className="rounded bg-red-700 px-3 py-1 text-sm font-semibold text-white"
          >
            Sí, empezar de nuevo
          </button>
          <button
            // The question appears in place of its button: focus goes to the
            // safe answer.
            autoFocus
            type="button"
            onClick={() => {
              setConfirming(false);
              requestAnimationFrame(() => startRef.current?.focus());
            }}
            className={RESTART_CLASS}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          ref={startRef}
          type="button"
          onClick={() => {
            setConfirming(true);
          }}
          className={RESTART_CLASS}
        >
          Empezar de nuevo
        </button>
      )}
    </div>
  );
}

/** Development only: the prototype's controls, left out of production. */
function PrototypeBar({
  advanced,
  showAll,
  onReplay,
}: {
  advanced: boolean;
  showAll: boolean;
  onReplay: () => void;
}): ReactElement {
  const buttonClass =
    "rounded border border-fuchsia-600 px-2 py-0.5 text-xs font-semibold text-fuchsia-800 dark:text-fuchsia-300";
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-fuchsia-800 dark:text-fuchsia-300">
        PROTOTIPO · {advanced ? "modo con IA" : "modo reducido"}
      </span>
      <button type="button" onClick={onReplay} className={buttonClass}>
        Ver la presentación de Atomy
      </button>
      <Link
        href={{
          pathname: LESSON_PATH,
          query: showAll ? {} : { todo: "" },
        }}
        className={buttonClass}
      >
        {showAll
          ? "Volver a la lección paso a paso"
          : "Ver toda la lección de golpe"}
      </Link>
    </div>
  );
}
