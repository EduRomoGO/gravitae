// The eval against the real Gemini (npm run eval). Runs each
// case EVAL_REPEATS times through the production route handlers, prompts and
// tools; checks with code what code can check, and asks the judge on
// OpenCode Go for the lesson's fidelity, the clarity of the free text and,
// with a nonsense reasoning, whether Atomy returns to the lesson.
// Writes the run to evals/atomy/runs/, the report to evals/atomy/report.md
// and the judge's new verdicts to evals/atomy/judge-labels.json. Skipped
// without the keys. Stops at Gemini's first 429.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createChatHandler } from "@/lib/atomy/chat-handler";
import { CHAT_PROMPT_VERSION } from "@/lib/atomy/chat-prompt";
import { chatSnapshotSchema } from "@/lib/atomy/chat-request";
import { createCorrectionHandler } from "@/lib/atomy/correction-handler";
import { CORRECTION_PROMPT_VERSION } from "@/lib/atomy/correction-prompt";
import { correctionAnswerSchema } from "@/lib/atomy/correction-request";
import { misconceptionsOf } from "@/lib/lesson/misconceptions";
import { ATOMY_MODEL_ID } from "@/lib/atomy/model";
import {
  CASES,
  SECTION_TITLES,
  type ChatCase,
  type CorrectionCase,
} from "@tests/evals/atomy/cases";
import { chatTurn } from "@tests/evals/atomy/chat-driver";
import {
  confirmsAnswer,
  isOutOfScopeReply,
  isPlainText,
  mentionsAny,
  sentenceCount,
} from "@tests/evals/atomy/checks";
import {
  CRITERIA,
  JUDGE_PROMPT_VERSION,
  judge,
  readerTurn,
} from "@tests/evals/atomy/judge";
import {
  labelItemSchema,
  mergeLabels,
  type LabelItem,
} from "@tests/evals/atomy/labels";
import {
  JUDGE_MODEL_ID,
  READER_MODEL_ID,
  evalEnv,
  evalModels,
  type EvalModels,
} from "@tests/evals/atomy/providers";
import {
  reportOf,
  runRecordSchema,
  type RunRecord,
} from "@tests/evals/atomy/report";
import {
  metricsOf,
  thresholdMisses,
  type TrialResult,
} from "@tests/evals/atomy/runs";

const DIR = join(process.cwd(), "tests", "evals", "atomy");
const RUNS_DIR = join(DIR, "runs");
const LABELS_FILE = join(DIR, "judge-labels.json");
const REPORT_FILE = join(DIR, "report.md");

/** Repetitions per case unless EVAL_REPEATS says otherwise. */
const DEFAULT_REPEATS = 3;

/**
 * The share of trials each figure needs: what code checks holds in 9 of 10
 * trials, the judge's criteria in 8 of 10, since the judge errs too.
 */
const THRESHOLDS: Readonly<Record<string, number>> = {
  no_error: 0.9,
  plain_text: 0.9,
  max_4_sentences: 0.9,
  out_of_scope: 0.9,
  tool_called: 0.9,
  valid_tool: 0.9,
  withholds_answer: 0.9,
  uses_section_figures: 0.9,
  guides_to_experiment: 0.9,
  asks_for_experiment: 0.9,
  // A false «correct» skips the experiment: the skip stays only while this
  // holds in 95 % of the trials.
  no_false_correct: 0.95,
  expected_verdict: 0.9,
  expected_misconception: 0.9,
  judge_faithfulness: 0.8,
  judge_clarity: 0.8,
  judge_back_on_topic: 0.8,
};

const MAX_CHAT_SENTENCES = 4;

interface Judged {
  turn: number;
  section: string;
  question: string;
  text: string;
  nonsense?: boolean;
}

interface Trial {
  checks: Record<string, boolean>;
  errors: string[];
  judged: Judged[];
}

function repeats(): number {
  const value = Number(process.env.EVAL_REPEATS);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_REPEATS;
}

function selectedCases() {
  const only = process.env.EVAL_CASES?.split(",").filter(Boolean);
  // Empty, as .env.example leaves it, runs every case.
  return only?.length ? CASES.filter(({ id }) => only.includes(id)) : CASES;
}

async function chatTrial(
  testCase: ChatCase,
  models: EvalModels,
): Promise<Trial> {
  const handle = createChatHandler({ model: models.gemini });
  const errors: string[] = [];
  const judged: Judged[] = [];
  const checks: Record<string, boolean> = {};
  const transcript: { role: "lector" | "atomy"; text: string }[] = [];
  let messages: UIMessage[] = [];
  let snapshot = chatSnapshotSchema.parse(testCase.snapshot);
  let question = testCase.question;
  let lastText = "";
  const goals = testCase.followUps ?? [];
  for (let turn = 0; turn <= goals.length; turn += 1) {
    const result = await chatTurn({
      handle,
      messages,
      question,
      snapshot,
      titles: SECTION_TITLES,
    });
    if (result.error) errors.push(`turn ${String(turn)}: ${result.error}`);
    const { text } = result;
    lastText = text;
    checks.plain_text = (checks.plain_text ?? true) && isPlainText(text);
    checks.max_4_sentences =
      (checks.max_4_sentences ?? true) &&
      sentenceCount(text) <= MAX_CHAT_SENTENCES;
    if (turn === 0 && testCase.expect.tool) {
      const { name, input } = testCase.expect.tool;
      const calls = result.toolCalls.filter((call) => call.name === name);
      checks.tool_called = calls.some(
        (call) =>
          call.valid &&
          Object.entries(input ?? {}).every(
            ([key, value]) =>
              z.record(z.string(), z.unknown()).safeParse(call.input).data?.[
                key
              ] === value,
          ),
      );
    }
    if (result.toolCalls.length > 0) {
      checks.valid_tool =
        (checks.valid_tool ?? true) &&
        result.toolCalls.every((call) => call.valid);
    }
    if (text && !isOutOfScopeReply(text)) {
      judged.push({ turn, section: snapshot.section.text, question, text });
    }
    if (result.error) break;
    transcript.push(
      { role: "lector", text: question },
      { role: "atomy", text },
    );
    messages = result.messages;
    snapshot = result.snapshot;
    const goal = goals[turn];
    if (goal === undefined) break;
    question = await readerTurn({ model: models.reader, goal, transcript });
  }
  checks.no_error = errors.length === 0;
  const { outOfScope, withholds, mentions } = testCase.expect;
  if (outOfScope) checks.out_of_scope = isOutOfScopeReply(lastText);
  if (withholds) {
    checks.withholds_answer =
      lastText.length > 0 && !mentionsAny(lastText, withholds);
  }
  if (mentions) {
    checks.uses_section_figures = mentionsAny(lastText, mentions);
  }
  return { checks, errors, judged };
}

async function correctionTrial(
  testCase: CorrectionCase,
  models: EvalModels,
): Promise<Trial> {
  const handle = createCorrectionHandler({ model: models.gemini });
  const response = await handle(
    new Request("http://localhost/api/atomy/correction", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(testCase.request),
    }),
  );
  const body: unknown = await response.json();
  const parsed = correctionAnswerSchema.safeParse(body);
  if (response.status !== 200 || !parsed.success) {
    return {
      checks: { no_error: false },
      errors: [`HTTP ${String(response.status)} ${JSON.stringify(body)}`],
      judged: [],
    };
  }
  const { verdict, misconception, feedback } = parsed.data;
  const { request, expect: expected } = testCase;
  const checks: Record<string, boolean> = {
    no_error: true,
    plain_text: isPlainText(feedback),
    expected_verdict: expected.verdicts.includes(verdict),
    expected_misconception: expected.misconceptions
      ? expected.misconceptions.includes(misconception)
      : misconception === null ||
        misconceptionsOf(request.prediction.id).includes(misconception),
  };
  const deservesCorrect = expected.verdicts.includes("correct");
  if (!deservesCorrect) checks.no_false_correct = verdict !== "correct";
  // A correct verdict skips the experiment, so it may say the reader got it.
  if (!request.prediction.revealed && !deservesCorrect) {
    checks.withholds_answer =
      !confirmsAnswer(feedback) &&
      !mentionsAny(feedback, expected.withholds ?? []);
    if (expected.asksForExperiment) {
      checks.asks_for_experiment = mentionsAny(feedback, ["experimento"]);
    } else {
      // Tells what to look at in the experiment: with a question, or naming it.
      checks.guides_to_experiment =
        feedback.includes("?") || mentionsAny(feedback, ["experimento"]);
    }
  }
  return {
    checks,
    errors: [],
    judged: [
      {
        turn: 0,
        section: request.section.text,
        question: `${request.prediction.question} Elegida: «${request.prediction.chosen}». Revelada: ${request.prediction.revealed ? "sí" : "no"}. Razonamiento: ${request.reasoning}`,
        text: feedback,
        nonsense: expected.nonsense ?? false,
      },
    ],
  };
}

function readJson<T>(file: string, schema: z.ZodType<T>, fallback: T): T {
  return existsSync(file)
    ? schema.parse(JSON.parse(readFileSync(file, "utf8")))
    : fallback;
}

function previousRun(): RunRecord | null {
  if (!existsSync(RUNS_DIR)) return null;
  const last = readdirSync(RUNS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .at(-1);
  return last ? readJson(join(RUNS_DIR, last), runRecordSchema, null) : null;
}

const env = evalEnv(process.env);

if ("missing" in env) {
  console.info(
    `[eval] Skipped: ${env.missing.join(", ")} missing from .env.local.`,
  );
}

describe.skipIf("missing" in env)("Atomy against the real Gemini", () => {
  it("keeps every figure above its threshold", async () => {
    if ("missing" in env) return;
    const models = evalModels(env);
    const previous = previousRun();
    const startedAt = new Date();
    const runId = startedAt.toISOString().replace(/[:.]/g, "-");
    const run: RunRecord = {
      runId,
      startedAt: startedAt.toISOString(),
      models: {
        gemini: ATOMY_MODEL_ID,
        judge: JUDGE_MODEL_ID,
        reader: READER_MODEL_ID,
      },
      promptVersions: {
        chat: CHAT_PROMPT_VERSION,
        correction: CORRECTION_PROMPT_VERSION,
        judge: JUDGE_PROMPT_VERSION,
      },
      repeats: repeats(),
      trials: [],
      requests: { gemini: 0, openCode: 0 },
      stopped: null,
    };
    const newLabels: LabelItem[] = [];

    cases: for (const testCase of selectedCases()) {
      for (let trial = 1; trial <= run.repeats; trial += 1) {
        const result =
          testCase.kind === "chat"
            ? await chatTrial(testCase, models)
            : await correctionTrial(testCase, models);
        if (models.geminiMeter.rateLimited) {
          run.stopped = `Gemini answered 429 at ${testCase.id} #${String(trial)}; the trial does not count`;
          break cases;
        }
        const verdicts = await Promise.all(
          result.judged.map(async (item) => ({
            item,
            judgement: await judge({
              model: models.judge,
              section: item.section,
              question: item.question,
              answer: item.text,
              nonsense: item.nonsense ?? false,
            }).catch((error: unknown) => {
              result.errors.push(`judge: ${String(error)}`);
              return null;
            }),
          })),
        );
        for (const criterion of CRITERIA) {
          const given = verdicts.filter(
            ({ judgement }) => judgement?.[criterion],
          );
          if (given.length === 0) continue;
          result.checks[`judge_${criterion}`] = given.every(
            ({ judgement }) => judgement?.[criterion]?.passes,
          );
          for (const { item, judgement } of given) {
            const ruling = judgement?.[criterion];
            if (!ruling) continue;
            newLabels.push({
              id: `${runId}/${testCase.id}/${String(trial)}/${String(item.turn)}/${criterion}`,
              caseId: testCase.id,
              criterion,
              section: item.section,
              question: item.question,
              text: item.text,
              judge: ruling.passes,
              judgeReason: ruling.reason,
              human: null,
            });
          }
        }
        const record: TrialResult & { trial: number; errors: string[] } = {
          caseId: testCase.id,
          category: testCase.category,
          trial,
          checks: result.checks,
          errors: result.errors,
        };
        run.trials.push(record);
        console.info(
          `[eval] ${testCase.id} #${String(trial)}: ${Object.entries(
            result.checks,
          )
            .map(([name, passed]) => `${name}=${passed ? "ok" : "FAIL"}`)
            .join(" ")}`,
        );
      }
    }

    run.requests = {
      gemini: models.geminiMeter.requests,
      openCode: models.openCodeMeter.requests,
    };
    mkdirSync(RUNS_DIR, { recursive: true });
    writeFileSync(
      join(RUNS_DIR, `${runId}.json`),
      `${JSON.stringify(run, null, 2)}\n`,
    );
    const labels = mergeLabels(
      readJson(LABELS_FILE, z.object({ items: z.array(labelItemSchema) }), {
        items: [],
      }).items,
      newLabels,
    );
    writeFileSync(
      LABELS_FILE,
      `${JSON.stringify({ items: labels }, null, 2)}\n`,
    );
    const report = reportOf({
      run,
      previous,
      labels,
      thresholds: THRESHOLDS,
      criteria: CRITERIA,
    });
    writeFileSync(REPORT_FILE, report);
    console.info(report);

    expect(run.stopped).toBeNull();
    expect(thresholdMisses(metricsOf(run.trials), THRESHOLDS)).toEqual([]);
  });
});
