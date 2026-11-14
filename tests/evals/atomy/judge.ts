// The LLM judge and the simulated reader, both on OpenCode Go. The judge
// reads only what code cannot check: whether the free text keeps to the
// lesson, whether it is clear and, when the reader wrote
// nonsense, whether Atomy leaves it aside and returns to the lesson. Its verdicts go to the
// labelling file, where the user validates it against human labels.

import { Output, generateText, type LanguageModel } from "ai";
import { z } from "zod";

export const JUDGE_PROMPT_VERSION = "judge-v3";

export const CRITERIA = ["faithfulness", "clarity", "back_on_topic"] as const;

export type Criterion = (typeof CRITERIA)[number];

// The judge's output keeps the Spanish keys its instructions name.
const verdict = z.object({
  cumple: z.boolean(),
  motivo: z.string(),
});

const judgement = z.object({
  fidelidad: verdict,
  claridad: verdict,
});

/** With a nonsense reasoning, the judge also rules on vuelve_al_tema. */
const nonsenseJudgement = judgement.extend({ vuelve_al_tema: verdict });

/** Each criterion and the key of the judge's output that rules on it. */
const OUTPUT_KEYS = {
  faithfulness: "fidelidad",
  clarity: "claridad",
  back_on_topic: "vuelve_al_tema",
} as const satisfies Record<Criterion, string>;

export interface Ruling {
  passes: boolean;
  reason: string;
}

export type Judgement = Partial<Record<Criterion, Ruling>>;

/**
 * The judge model reasons before answering, and with the whole lesson's
 * section it spends thousands of tokens on it (6610 in one measure of
 * 2026-11-13). The reasoning counts against this cap: with 2000 it took
 * all of it, left no text and the SDK threw NoOutputGeneratedError.
 */
const JUDGE_MAX_OUTPUT_TOKENS = 16000;

const JUDGE_INSTRUCTIONS = `Evalúas las respuestas de Atomy, el asistente de una lección sobre la ley de la gravitación universal de Newton para lectores de cualquier edad. Recibes el texto de la sección que el lector tenía delante, lo que escribió el lector y la respuesta de Atomy. Juzgas dos criterios por separado:

- fidelidad: cumple si toda la física de la respuesta es correcta y coincide con el texto de la sección (sus cifras, sus palabras y su explicación). No cumple si afirma algo que contradice la sección o la física, o si inventa cifras que la sección no da y que no vienen de un cálculo citado.
- claridad: cumple si la respuesta contesta a lo que escribió el lector, en castellano sencillo para cualquier lector, sin rodeos y sin jerga sin explicar. No cumple si es confusa, si no contesta o si se va por las ramas. Si llega <chorrada/>, no contestar a la chorrada es lo correcto y no cuenta en contra.
- vuelve_al_tema: solo si llega <chorrada/>, que indica que lo que escribió el lector es una chorrada sin relación con la predicción. Cumple si la respuesta no repite, no parafrasea y no comenta lo que escribió el lector, y vuelve a la lección con una entrada como «Volviendo al tema». No cumple si recoge lo escrito, aunque sea con otras palabras, o si lo valora.

Una respuesta que se niega a dar la solución de una predicción y guía con una pregunta cumple los dos criterios si lo hace con física correcta y de forma clara. En motivo, explica en una frase el hecho concreto que decide el veredicto.`;

export async function judge({
  model,
  section,
  question,
  answer,
  nonsense = false,
}: {
  model: LanguageModel;
  section: string;
  question: string;
  answer: string;
  /** The reader's text is nonsense: the judge rules on back_on_topic too. */
  nonsense?: boolean;
}): Promise<Judgement> {
  const { output } = await generateText({
    model,
    instructions: JUDGE_INSTRUCTIONS,
    prompt: [
      `<seccion>\n${section}\n</seccion>`,
      `<lector>\n${question}\n</lector>`,
      ...(nonsense ? ["<chorrada/>"] : []),
      `<respuesta_de_atomy>\n${answer}\n</respuesta_de_atomy>`,
    ].join("\n\n"),
    output: Output.object({
      schema: nonsense ? nonsenseJudgement : judgement,
    }),
    maxOutputTokens: JUDGE_MAX_OUTPUT_TOKENS,
  });
  const rulings: Partial<Record<string, z.infer<typeof verdict>>> = output;
  return Object.fromEntries(
    CRITERIA.flatMap((criterion) => {
      const ruling = rulings[OUTPUT_KEYS[criterion]];
      return ruling
        ? [[criterion, { passes: ruling.cumple, reason: ruling.motivo }]]
        : [];
    }),
  );
}

const READER_INSTRUCTIONS = `Haces de lector, de cualquier edad, en una lección sobre la gravitación con un asistente llamado Atomy. Escribe solo el siguiente mensaje del lector, en castellano, de una o dos frases, sin comillas ni explicaciones.`;

/** The simulated reader's next message, after Atomy's last answer. */
export async function readerTurn({
  model,
  goal,
  transcript,
}: {
  model: LanguageModel;
  goal: string;
  transcript: readonly { role: "lector" | "atomy"; text: string }[];
}): Promise<string> {
  const { text } = await generateText({
    model,
    instructions: READER_INSTRUCTIONS,
    prompt: [
      "<conversacion>",
      ...transcript.map(({ role, text: line }) => `${role}: ${line}`),
      "</conversacion>",
      `<objetivo_del_lector>${goal}</objetivo_del_lector>`,
    ].join("\n"),
    maxOutputTokens: 1000,
  });
  return text.trim().slice(0, 900);
}
