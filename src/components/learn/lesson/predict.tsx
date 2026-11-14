"use client";

// Predict–observe–explain around a widget, voiced by
// Atomy: Atomy asks, the reader answers, the widget appears to check it, and
// on «Comprobar» Atomy says whether the answer was right and explains why.
// How the reader answers is the prediction's `response`: its `input` (the
// options to pick from, a ranking to order…) reports the key of the reader's
// answer through usePrediction, among the keys of its `answers`, and its
// `answer` is the key of the right one. Everything else is the same for every kind of answer: the verdict,
// the explanation and, in the advanced mode, Atomy's correction of the
// reader's reasoning. The verdict resolves the step, which shows the next
// one. In the advanced mode pressing Atomy opens the chat about this
// experiment.
// In the advanced mode the reasoning's field shows with the question and the
// experiment waits: the reader either opens it or sends the reasoning first.
// A correction that finds the reasoning correct before the experiment shows
// resolves the prediction without it, and the experiment stays one click
// away; any other outcome shows the experiment, as in the reduced mode.
// The prediction's phase is part of the lesson's progress, kept under its id:
// unanswered; answered, with the experiment waiting or shown; or revealed,
// by the experiment or by a correction that skipped it. An answer the current
// ones lack forgets it. Whether a skipped experiment is open again is not
// kept: a reload closes it.

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { z } from "zod";
import { AtomyBubble } from "@/components/learn/atomy/atomy-bubble";
import { useOpenChat } from "@/components/atomy/atomy-chat";
import { INTERFACE } from "@/components/learn/lesson/lesson-sections-dom";
import { useLessonMode } from "@/components/learn/lesson/lesson-mode";
import { usePersistentState } from "@/components/shared/progress";
import { ReasoningCorrection } from "@/components/learn/lesson/reasoning-correction";
import type { PredictionResponse } from "@/components/learn/lesson/responses";
import { useResolveStep, useShowAll } from "@/components/learn/lesson/steps";
import type { Verdict } from "@/lib/lesson/verdicts";
import type { PredictionId } from "@/lib/lesson/predictions";

/** What an answer input reads and reports. */
export interface Prediction {
  /** The key of the reader's answer, or null while they have not given a whole one. */
  chosen: string | null;
  /** The key of the right answer. */
  answer: string;
  /** Whether the reader checked the answer. */
  revealed: boolean;
  /** Whether the input stops changing the answer: checked, or being corrected. */
  locked: boolean;
  choose: (chosen: string | null) => void;
}

const PredictionContext = createContext<Prediction | null>(null);

/** The prediction an answer input belongs to. */
export function usePrediction(): Prediction {
  const prediction = useContext(PredictionContext);
  if (prediction === null)
    throw new Error("An answer input goes inside a <Predict>.");
  return prediction;
}

/** Where the reader is in a prediction. */
type PredictionPhase =
  | { readonly phase: "unanswered" }
  | {
      readonly phase: "answered";
      readonly chosen: string;
      /** In the advanced mode the experiment waits until the reader opens it. */
      readonly experiment: "waiting" | "shown";
    }
  | {
      readonly phase: "revealed";
      readonly chosen: string;
      /** A correction that found the reasoning correct skips the experiment. */
      readonly via: "experiment" | "correction";
    };

/** The phase of a prediction whose answers have these keys. */
function phaseSchema(keys: readonly string[]): z.ZodType<PredictionPhase> {
  const chosen = z.string().refine((key) => keys.includes(key));
  return z.discriminatedUnion("phase", [
    z.strictObject({ phase: z.literal("unanswered") }),
    z.strictObject({
      phase: z.literal("answered"),
      chosen,
      experiment: z.enum(["waiting", "shown"]),
    }),
    z.strictObject({
      phase: z.literal("revealed"),
      chosen,
      via: z.enum(["experiment", "correction"]),
    }),
  ]);
}

/** The phase after the reader's answer changes to `chosen`. */
function choosing(
  current: PredictionPhase,
  chosen: string | null,
): PredictionPhase {
  if (current.phase === "revealed") return current;
  if (chosen === null) return { phase: "unanswered" };
  return {
    phase: "answered",
    chosen,
    experiment: current.phase === "answered" ? current.experiment : "waiting",
  };
}

const buttonClass =
  "rounded bg-amber-700 px-4 py-2 text-base sm:text-sm font-semibold text-white";

export function Predict({
  id,
  question,
  response,
  explanation,
  children,
}: {
  /** Keeps the prediction's progress and its chat across rewordings. */
  id: PredictionId;
  question: string;
  response: PredictionResponse;
  explanation: ReactNode;
  /** The experiment, shown once the reader answers. */
  children?: ReactNode;
}): ReactElement {
  const { answers, answer, input } = response;
  const showAll = useShowAll();
  const keys = Object.keys(answers).join("\n");
  const schema = useMemo(() => phaseSchema(keys.split("\n")), [keys]);
  const [state, update] = usePersistentState<PredictionPhase>(
    `prediccion:${id}`,
    showAll
      ? { phase: "revealed", chosen: answer, via: "experiment" }
      : { phase: "unanswered" },
    schema,
  );
  // Opening a skipped experiment again is a glance, not progress.
  const [seeAnyway, setSeeAnyway] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const resolve = useResolveStep();
  const advanced = useLessonMode() === "ia";
  const openChat = useOpenChat();
  const hasExperiment = children !== undefined;
  const chosen = state.phase === "unanswered" ? null : state.chosen;
  const revealed = state.phase === "revealed";
  // In the reduced mode, or without an experiment, the answer opens it.
  const experimentShown = (() => {
    if (!advanced || !hasExperiment) return true;
    switch (state.phase) {
      case "unanswered":
        return false;
      case "answered":
        return state.experiment === "shown";
      case "revealed":
        return state.via === "experiment" || seeAnyway;
    }
  })();
  const wordsOf = (key: string) => answers[key] ?? key;
  const chat = openChat && {
    onAvatarClick: () => {
      openChat({ prediction: id, question });
    },
    avatarLabel: "Pregúntale a Atomy sobre este experimento",
  };
  const prediction: Prediction = {
    chosen,
    answer,
    revealed,
    locked: revealed || correcting,
    choose: (next) => {
      update((current) => choosing(current, next));
    },
  };
  const showExperiment = () => {
    update((current) =>
      current.phase === "answered"
        ? { ...current, experiment: "shown" }
        : current,
    );
  };
  // Only a correction asked for before the experiment shows comes here.
  const corrected = (verdict: Verdict | null) => {
    if (verdict === "correct") {
      update((current) =>
        current.phase === "answered"
          ? { phase: "revealed", chosen: current.chosen, via: "correction" }
          : current,
      );
      resolve();
    } else {
      showExperiment();
    }
  };
  const check = () => {
    update((current) =>
      current.phase === "answered"
        ? { phase: "revealed", chosen: current.chosen, via: "experiment" }
        : current,
    );
    resolve();
  };
  const experimentBlock = experimentShown && hasExperiment && (
    <div {...INTERFACE} className="space-y-4">
      {children}
    </div>
  );

  function afterQuestion(): ReactNode {
    switch (state.phase) {
      case "unanswered":
        return null;
      case "answered":
        return (
          <>
            {experimentBlock}
            {experimentShown && (
              <button
                {...INTERFACE}
                type="button"
                onClick={check}
                className={buttonClass}
              >
                Comprobar
              </button>
            )}
          </>
        );
      case "revealed": {
        const verdict = (
          <AtomyBubble role="status" {...chat}>
            {state.via === "experiment" && (
              <p className="font-semibold">
                {state.chosen === answer
                  ? "¡Has acertado!"
                  : `Has elegido «${wordsOf(state.chosen)}», pero la respuesta correcta es «${wordsOf(answer)}».`}
              </p>
            )}
            <div className="space-y-2 text-base sm:text-sm">{explanation}</div>
          </AtomyBubble>
        );
        if (state.via === "experiment")
          return (
            <>
              {experimentBlock}
              {verdict}
            </>
          );
        return (
          <>
            {verdict}
            {hasExperiment && (
              <>
                <button
                  {...INTERFACE}
                  type="button"
                  aria-expanded={seeAnyway}
                  onClick={() => {
                    setSeeAnyway((open) => !open);
                  }}
                  className="rounded border border-amber-700 px-4 py-2 text-base sm:text-sm font-semibold text-amber-800 dark:text-amber-300"
                >
                  Ver el experimento igualmente
                </button>
                {experimentBlock}
              </>
            )}
          </>
        );
      }
    }
  }

  return (
    <PredictionContext.Provider value={prediction}>
      <div className="space-y-4">
        <AtomyBubble
          {...chat}
          after={
            <div className="space-y-2">
              {input}
              {state.phase === "answered" &&
                experimentShown &&
                hasExperiment && (
                  <p {...INTERFACE} className="text-base sm:text-sm">
                    Haz el experimento de abajo y luego comprueba si has
                    acertado.
                  </p>
                )}
              <ReasoningCorrection
                id={id}
                question={question}
                answer={wordsOf(answer)}
                chosen={
                  chosen === null
                    ? null
                    : { key: chosen, words: wordsOf(chosen) }
                }
                revealed={revealed}
                experimentShown={experimentShown}
                pending={correcting}
                onPendingChange={setCorrecting}
                onShowExperiment={showExperiment}
                onCorrected={corrected}
              />
            </div>
          }
        >
          {/* A short line beside the avatar, so the question starts under it
              and takes the whole width. */}
          <p className="font-semibold">¿Tú qué crees?</p>
          <p>{question}</p>
        </AtomyBubble>
        {afterQuestion()}
      </div>
    </PredictionContext.Provider>
  );
}
