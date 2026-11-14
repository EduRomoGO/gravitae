"use client";

// The reader's reasoning in a prediction, corrected by Atomy with the model.
// An optional field, beside the question, asks why the reader thinks so;
// once they answer, sending it gets Atomy's verdict, the misconception behind
// it and an explanation. Before the reader checks the answer, only the
// explanation shows: the verdict and the misconception would give the answer
// away. While the experiment waits, a second button opens it, and the
// prediction learns the outcome of a correction asked for before it showed.
// Only in the advanced mode, which exists only with the model configured:
// in the reduced mode the prediction corrects the answer by code, as always.
// A failure leaves a controlled message and the prediction's own correction;
// one of the provider's asks again whether the model can be reached
// (components/shared/atomy-mode.tsx), which may turn the app to the reduced
// mode.
// The reasoning written and the correction received are part of the lesson's
// progress, kept under the prediction's id with the key of the answer it
// corrects; a correction on its way is not.

import { useId, type ReactElement } from "react";
import { z } from "zod";
import { useLessonMode } from "@/components/learn/lesson/lesson-mode";
import { useRecordPrediction } from "@/components/learn/atomy/chat-predictions";
import { lessonContent } from "@/components/learn/atomy/chat-snapshot";
import {
  INTERFACE,
  sectionElement,
} from "@/components/learn/lesson/lesson-sections-dom";
import {
  CORRECTION_ERROR_CODES,
  MAX_REASONING_CHARS,
  correctionResponseSchema,
  correctionErrorCodeSchema,
  type CorrectionResponse,
  type CorrectionErrorCode,
  type CorrectionRequest,
} from "@/lib/atomy/correction-request";
import type { Verdict } from "@/lib/lesson/verdicts";
import { MISCONCEPTIONS } from "@/lib/lesson/misconceptions";
import { FALLBACK_NOTE } from "@/components/atomy/fallback-note";
import { usePersistentState } from "@/components/shared/progress";
import { useAtomyMode } from "@/components/shared/atomy-mode";
import {
  PREDICTION_SECTIONS,
  type PredictionId,
} from "@/lib/lesson/predictions";

const CORRECTION_URL = "/api/atomy/correction";

const VERDICT_TEXT: Record<Verdict, string> = {
  correct: "¡Genial!",
  partial: "Tu razonamiento es correcto en parte.",
  incorrect: "Tu razonamiento se apoya en una idea equivocada.",
};

const ERROR_TEXT: Record<CorrectionErrorCode, string> = {
  "invalid-output":
    "Atomy no ha podido corregir tu razonamiento esta vez. Puedes reintentarlo o seguir: la predicción se corrige igual al comprobarla.",
  "rate-limit":
    "Atomy ha llegado a su límite de uso; inténtalo más tarde. La predicción se corrige igual al comprobarla.",
  provider:
    "Atomy no responde ahora mismo. Puedes reintentarlo o seguir: la predicción se corrige igual al comprobarla.",
};

/** A correction that arrived keeps the key of the answer it corrects. */
type CorrectionOutcome =
  | { kind: "pending" }
  | { kind: "corrected"; chosen: string; correction: CorrectionResponse }
  | { kind: "failed"; chosen: string; code: CorrectionErrorCode };

/** The outcomes kept in the progress: those that arrived. */
const savedOutcomeSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("corrected"),
      chosen: z.string(),
      correction: correctionResponseSchema,
    }),
    z.strictObject({
      kind: z.literal("failed"),
      chosen: z.string(),
      code: z.enum(CORRECTION_ERROR_CODES),
    }),
  ])
  .nullable();

const reasoningSchema = z.string().max(MAX_REASONING_CHARS);

function errorCodeOf(body: unknown): CorrectionErrorCode {
  const error =
    typeof body === "object" && body !== null && "error" in body
      ? body.error
      : undefined;
  return correctionErrorCodeSchema.parse(error);
}

/** The prediction's section as the correction reads it, while it is shown. */
function sectionToCorrect(
  prediction: PredictionId,
): CorrectionRequest["section"] | null {
  const id = PREDICTION_SECTIONS[prediction];
  const section = sectionElement(id);
  return section ? { ...lessonContent(section, id), id } : null;
}

async function requestCorrection(
  body: CorrectionRequest,
): Promise<{ correction: CorrectionResponse } | { code: CorrectionErrorCode }> {
  try {
    const response = await fetch(CORRECTION_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: unknown = await response.json();
    if (!response.ok) return { code: errorCodeOf(json) };
    const correction = correctionResponseSchema.safeParse(json);
    return correction.success
      ? { correction: correction.data }
      : { code: "invalid-output" };
  } catch {
    return { code: "provider" };
  }
}

/** The reader's answer: its key, and the words the model reads. */
export interface ChosenAnswer {
  readonly key: string;
  readonly words: string;
}

export function ReasoningCorrection({
  id,
  question,
  answer,
  chosen,
  revealed,
  experimentShown,
  pending,
  onPendingChange,
  onShowExperiment,
  onCorrected,
}: {
  id: PredictionId;
  question: string;
  /** The right answer, in words. */
  answer: string;
  /** The reader's answer; null while they have not given one. */
  chosen: ChosenAnswer | null;
  revealed: boolean;
  /** Whether the experiment is shown; while it is not, a button opens it. */
  experimentShown: boolean;
  /** A correction on its way; the prediction locks its answer meanwhile. */
  pending: boolean;
  onPendingChange: (pending: boolean) => void;
  onShowExperiment: () => void;
  /**
   * The verdict of a correction asked for before the experiment showed, or
   * null when it failed.
   */
  onCorrected: (verdict: Verdict | null) => void;
}): ReactElement | null {
  const advanced = useLessonMode() === "ia";
  const { recheck } = useAtomyMode();
  const [reasoning, updateReasoning] = usePersistentState(
    `razonamiento:${id}`,
    "",
    reasoningSchema,
  );
  const [saved, updateSaved] = usePersistentState(
    `correccion:${id}`,
    null,
    savedOutcomeSchema,
  );
  const outcome: CorrectionOutcome | null = pending
    ? { kind: "pending" }
    : saved;
  const fieldId = useId();
  const countId = useId();
  const titleId = useId();
  // A correction belongs to the answer it was asked for.
  const current =
    outcome && (outcome.kind === "pending" || outcome.chosen === chosen?.key)
      ? outcome
      : null;
  useRecordPrediction(
    chosen !== null
      ? {
          id,
          question,
          chosen: chosen.words,
          revealed,
          ...(current?.kind === "corrected"
            ? { verdict: current.correction.verdict }
            : {}),
        }
      : null,
  );
  if (!advanced) return null;

  const send = async () => {
    const sectionToSend = sectionToCorrect(id);
    const text = reasoning.trim();
    if (!text || pending || chosen === null) return;
    const beforeExperiment = !experimentShown;
    onPendingChange(true);
    const result = sectionToSend
      ? await requestCorrection({
          section: sectionToSend,
          prediction: { id, question, chosen: chosen.words, answer, revealed },
          reasoning: text,
        })
      : ({ code: "provider" } as const);
    onPendingChange(false);
    if ("code" in result && result.code === "provider") recheck();
    updateSaved(() =>
      "correction" in result
        ? {
            kind: "corrected",
            chosen: chosen.key,
            correction: result.correction,
          }
        : { kind: "failed", chosen: chosen.key, code: result.code },
    );
    if (beforeExperiment)
      onCorrected("correction" in result ? result.correction.verdict : null);
  };
  return (
    <div className="space-y-2">
      <form
        {...INTERFACE}
        className="space-y-1"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label
          htmlFor={fieldId}
          className="block text-base sm:text-sm font-semibold"
        >
          ¿Por qué lo crees? (opcional)
        </label>
        <textarea
          id={fieldId}
          value={reasoning}
          maxLength={MAX_REASONING_CHARS}
          rows={2}
          aria-describedby={countId}
          onChange={(event) => {
            const text = event.target.value;
            updateReasoning(() => text);
          }}
          className="w-full rounded border border-slate-500 bg-white p-2 text-base sm:text-sm dark:border-slate-400 dark:bg-slate-900"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p
            id={countId}
            className="text-xs text-slate-700 dark:text-slate-300"
          >
            {`${String(reasoning.length)} de ${String(MAX_REASONING_CHARS)} caracteres`}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={
                pending || chosen === null || reasoning.trim().length === 0
              }
              className="rounded bg-violet-700 px-3 py-1 text-base sm:text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Enviar a Atomy
            </button>
            {!experimentShown && (
              <button
                type="button"
                disabled={pending || chosen === null}
                onClick={onShowExperiment}
                className="rounded bg-amber-700 px-3 py-1 text-base sm:text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hacer el experimento
              </button>
            )}
          </div>
        </div>
      </form>
      <section
        {...INTERFACE}
        aria-labelledby={titleId}
        className={current ? "space-y-1 text-base sm:text-sm" : "sr-only"}
      >
        <h3 id={titleId} className="sr-only">
          {/* The question tells one prediction's correction from another's. */}
          Corrección de tu razonamiento: {question}
        </h3>
        <div aria-live="polite" className="space-y-1">
          {current?.kind === "pending" && (
            <p>Atomy está leyendo tu razonamiento…</p>
          )}
          {current?.kind === "corrected" && (
            <>
              {revealed && (
                <p className="font-semibold">
                  {VERDICT_TEXT[current.correction.verdict]}
                </p>
              )}
              <p>{current.correction.feedback}</p>
              {revealed && current.correction.misconception && (
                <p>
                  Idea a revisar:{" "}
                  {MISCONCEPTIONS[current.correction.misconception].idea}
                </p>
              )}
              {current.correction.fallback && (
                <p className="text-xs font-semibold text-slate-700 italic dark:text-slate-300">
                  {FALLBACK_NOTE}
                </p>
              )}
            </>
          )}
          {current?.kind === "failed" && <p>{ERROR_TEXT[current.code]}</p>}
        </div>
        {current?.kind === "failed" && current.code !== "rate-limit" && (
          <button
            type="button"
            onClick={() => {
              void send();
            }}
            className="rounded border border-violet-700 px-3 py-1 text-base sm:text-sm font-semibold text-violet-800 dark:text-violet-300"
          >
            Reintentar
          </button>
        )}
      </section>
    </div>
  );
}
