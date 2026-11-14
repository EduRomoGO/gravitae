// A fake Gemini for the Playwright tests: answers streamGenerateContent as
// Gemini does, as server-sent events, so the production build runs its real
// route handler against it. The route handler reaches it through
// ATOMY_GEMINI_BASE_URL.
//
// Control endpoints for the tests:
// - GET  /__requests: the bodies of every generation request received.
// - POST /__hold {key}: answers to a request whose body contains `key` stop
//   before their last fragment...
// - POST /__release {key}: ...until this releases them.
// - POST /__fail {key}: requests whose body contains `key` fail with a 500...
// - POST /__recover {key}: ...until this lets them through.
//
// GET .../models/<id> answers as Gemini does for the model's resource, the
// probe of the model's status (src/lib/atomy/model-status.ts).
//
// Scripted failures, by a marker in the reader's question:
// - [guion:429]: a 429, Gemini's RESOURCE_EXHAUSTED.
// - [guion:lento]: the answer, after a pause before its first fragment.
// - [guion:longitud]: the answer, cut by MAX_TOKENS.
// - [guion:bloqueado]: no answer, the question blocked for SAFETY.
// - [guion:respaldo], anywhere in the request, also the correction's: a 429
//   from the main model only, so a fallback model answers.
// The failures answer with retry-after: 0, so the AI SDK's retries do not
// wait.
//
// Scripted tool call: a question containing FACTOR_SCRIPT gets a call to
// compute_force_factor with FACTOR_SCRIPT_INPUT; the request that carries
// the tool's result gets an answer quoting the factor the app computed.
//
// Scripted tools of the page, by a marker anywhere in the turn: the first
// request gets the call, and the request that carries the page's result (or
// the AI SDK's error for an invalid call) gets PAGE_SCRIPT_ANSWER.
// - [guion:seccion]: go_to_section to the first section.
// - [guion:bucle]: go_to_section again on every request, results included.
// - [guion:widget]: set_widget on the beads and threads of «cualquiera».
// - [guion:widget-fuera]: set_widget with a distance above their range.
// - [guion:buscador-partir]: start_from on the orbit finder, from Moth I.
// - [guion:buscador-cerrar]: close_orbit on the orbit finder.
//
// The reasoning's correction (generateContent, not streamed) gets an
// incorrect verdict with the first misconception its schema offers and
// CORRECTION_FEEDBACK, unless its reasoning carries a marker:
// - [guion:razonamiento-invalido]: an incorrect verdict without a
//   misconception, which breaks the rules on every attempt.
// - [guion:razonamiento-reintento]: that same output first, and the valid
//   one once the request carries the validation error.
// - [guion:razonamiento-correcto]: a correct verdict, without a
//   misconception.
// - [guion:razonamiento-parcial]: a partial verdict, without a
//   misconception.
// - [guion:idea=<id>]: the misconception <id>, when its schema offers it.
//
// Run with `node e2e/fake-gemini.mts <port>` (Node strips the types).

import { createServer, type IncomingMessage } from "node:http";
import { text } from "node:stream/consumers";
import { z } from "zod";
import { ATOMY_MODEL_ID } from "../../src/lib/atomy/model.ts";

const port = Number(process.argv[2] ?? process.env.FAKE_GEMINI_PORT);

/** The scripted answer, in the fragments it streams. */
const FAKE_ANSWER = [
  "En la Luna la caja ",
  "gana velocidad más despacio, ",
  "por eso tarda más en caer.",
];

const FACTOR_SCRIPT = "[guion:factor]";
const FACTOR_SCRIPT_INPUT = { massA: 2, massB: 1, distance: 3 };

// Only the fields the fake reads; the rest of the body passes through.
const GeminiPart = z.looseObject({
  text: z.string().optional(),
  functionResponse: z
    .looseObject({
      name: z.string(),
      response: z.looseObject({ content: z.unknown().optional() }).optional(),
    })
    .optional(),
});

const WIDGET_SCRIPT_INPUT = {
  widget: "hilos",
  massA: 4,
  massB: 1,
  distance: 2,
};
const PAGE_SCRIPT_ANSWER = "Mira lo que ha cambiado en la página.";

const PAGE_SCRIPTS: Record<string, { name: string; args: unknown }> = {
  "[guion:seccion]": { name: "go_to_section", args: { section: "caida" } },
  "[guion:bucle]": { name: "go_to_section", args: { section: "caida" } },
  "[guion:widget]": { name: "set_widget", args: WIDGET_SCRIPT_INPUT },
  "[guion:widget-fuera]": {
    name: "set_widget",
    args: { ...WIDGET_SCRIPT_INPUT, distance: 9 },
  },
  "[guion:buscador-partir]": { name: "start_from", args: { orbit: "moth-i" } },
  "[guion:buscador-cerrar]": { name: "close_orbit", args: {} },
};

/**
 * The page's script of this turn, if its question carries one: the last
 * reader's text, so each question of a conversation runs its own script.
 */
function pageScriptOf(body: GeminiBody): string | undefined {
  const question = body.contents
    .filter((content) => content.role === "user")
    .map((content) => content.parts.map((part) => part.text ?? "").join(""))
    .findLast((text) => text !== "");
  return Object.keys(PAGE_SCRIPTS).find(
    (script) => question?.includes(script) === true,
  );
}

/** The request carries the result of the scripted tool. */
function carriesResult(body: GeminiBody, name: string): boolean {
  const parts = body.contents.at(-1)?.parts ?? [];
  return parts.some((part) => part.functionResponse?.name === name);
}

const GeminiBody = z.looseObject({
  contents: z.array(
    z.looseObject({ role: z.string(), parts: z.array(GeminiPart) }),
  ),
});
type GeminiBody = z.infer<typeof GeminiBody>;

const FactorContent = z.looseObject({ factor: z.string() });

/** The factor compute_force_factor answered with, if this request carries it. */
function computedFactor(body: GeminiBody): string | undefined {
  const parts = body.contents.at(-1)?.parts ?? [];
  const content = parts.find(
    (part) => part.functionResponse?.name === "compute_force_factor",
  )?.functionResponse?.response?.content;
  return FactorContent.safeParse(content).data?.factor;
}

function asksForFactor(body: GeminiBody): boolean {
  const last = body.contents.at(-1);
  return (
    last?.role === "user" &&
    last.parts.some((part) => part.text?.includes(FACTOR_SCRIPT) === true)
  );
}

const SCRIPTS = [
  "[guion:429]",
  "[guion:lento]",
  "[guion:longitud]",
  "[guion:bloqueado]",
] as const;
type Script = (typeof SCRIPTS)[number];

/** How long [guion:lento] waits; less than the app's first-chunk timeout. */
const SLOW_MS = 1500;

function scriptOf(body: GeminiBody): Script | undefined {
  const last = body.contents.at(-1);
  if (last?.role !== "user") return undefined;
  return SCRIPTS.find((script) =>
    last.parts.some((part) => part.text?.includes(script) === true),
  );
}

function geminiError(code: number, status: string) {
  return JSON.stringify({ error: { code, message: status, status } });
}

const failing = new Set<string>();

/** [guion:respaldo] asks the main model, which has run out of quota. */
function mainOutOfQuota(pathname: string, body: string): boolean {
  return (
    body.includes("[guion:respaldo]") &&
    pathname.includes(`/models/${ATOMY_MODEL_ID}:`)
  );
}

const requests: unknown[] = [];
const holds = new Map<string, Promise<void>>();
const releases = new Map<string, () => void>();

function hold(key: string) {
  if (holds.has(key)) return;
  holds.set(
    key,
    new Promise((resolve) => {
      releases.set(key, resolve);
    }),
  );
}

function release(key: string) {
  releases.get(key)?.();
  releases.delete(key);
  holds.delete(key);
}

function readBody(request: IncomingMessage): Promise<string> {
  return text(request);
}

const KeyBody = z.object({ key: z.string() });

function event(data: unknown): string {
  return `data: ${JSON.stringify(data)}\r\n\r\n`;
}

const USAGE = {
  promptTokenCount: 100,
  candidatesTokenCount: 20,
  totalTokenCount: 120,
};

function functionCallChunk(name: string, args: unknown) {
  return {
    candidates: [
      {
        content: { role: "model", parts: [{ functionCall: { name, args } }] },
        index: 0,
        finishReason: "STOP",
      },
    ],
    usageMetadata: USAGE,
    responseId: "fake-response",
  };
}

function textChunk(text: string, last: boolean, finishReason = "STOP") {
  return {
    candidates: [
      {
        content: { role: "model", parts: [{ text }] },
        index: 0,
        ...(last ? { finishReason } : {}),
      },
    ],
    ...(last ? { usageMetadata: USAGE } : {}),
    responseId: "fake-response",
  };
}

const CORRECTION_FEEDBACK =
  "¿Cuántos hilos ves al doblar las dos masas? Cuéntalos en el experimento.";

const CorrectionBody = GeminiBody.extend({
  generationConfig: z
    .looseObject({
      responseJsonSchema: z
        .looseObject({
          properties: z
            .looseObject({
              misconception: z
                .looseObject({
                  anyOf: z
                    .array(
                      z.looseObject({ enum: z.array(z.string()).optional() }),
                    )
                    .optional(),
                })
                .optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});
type CorrectionBody = z.infer<typeof CorrectionBody>;

/** The scripted correction of a reasoning, as Gemini's JSON text. */
function correctionOutput(body: CorrectionBody, raw: string): string {
  const ids =
    body.generationConfig?.responseJsonSchema?.properties?.misconception?.anyOf?.find(
      (option) => option.enum,
    )?.enum ?? [];
  const named = /\[guion:idea=([a-z-]+)\]/.exec(raw)?.[1];
  const offered =
    (named !== undefined && ids.includes(named) ? named : ids[0]) ?? null;
  const right = raw.includes("[guion:razonamiento-correcto]");
  const broken =
    raw.includes("[guion:razonamiento-invalido]") ||
    (raw.includes("[guion:razonamiento-reintento]") &&
      !raw.includes("error_de_validacion"));
  if (right)
    return JSON.stringify({
      verdict: "correct",
      misconception: null,
      feedback: CORRECTION_FEEDBACK,
    });
  if (raw.includes("[guion:razonamiento-parcial]"))
    return JSON.stringify({
      verdict: "partial",
      misconception: null,
      feedback: CORRECTION_FEEDBACK,
    });
  return JSON.stringify({
    verdict: "incorrect",
    misconception: broken ? null : offered,
    feedback: CORRECTION_FEEDBACK,
  });
}

const server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/__requests") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(requests));
      return;
    }
    if (
      request.method === "POST" &&
      (url.pathname === "/__hold" || url.pathname === "/__release")
    ) {
      const { key } = KeyBody.parse(JSON.parse(await readBody(request)));
      if (url.pathname === "/__hold") hold(key);
      else release(key);
      response.writeHead(204).end();
      return;
    }
    if (
      request.method === "POST" &&
      (url.pathname === "/__fail" || url.pathname === "/__recover")
    ) {
      const { key } = KeyBody.parse(JSON.parse(await readBody(request)));
      if (url.pathname === "/__fail") failing.add(key);
      else failing.delete(key);
      response.writeHead(204).end();
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname.endsWith(":generateContent")
    ) {
      const body = await readBody(request);
      const parsed = CorrectionBody.parse(JSON.parse(body));
      requests.push(parsed);
      if (mainOutOfQuota(url.pathname, body)) {
        response
          .writeHead(429, {
            "content-type": "application/json",
            "retry-after": "0",
          })
          .end(geminiError(429, "RESOURCE_EXHAUSTED"));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: correctionOutput(parsed, body) }],
              },
              index: 0,
              finishReason: "STOP",
            },
          ],
          usageMetadata: USAGE,
          responseId: "fake-response",
        }),
      );
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname.endsWith(":streamGenerateContent")
    ) {
      const body = await readBody(request);
      const parsed = GeminiBody.parse(JSON.parse(body));
      requests.push(parsed);
      const script = scriptOf(parsed);
      if ([...failing].some((key) => body.includes(key))) {
        response
          .writeHead(500, {
            "content-type": "application/json",
            "retry-after": "0",
          })
          .end(geminiError(500, "INTERNAL"));
        return;
      }
      if (script === "[guion:429]" || mainOutOfQuota(url.pathname, body)) {
        response
          .writeHead(429, {
            "content-type": "application/json",
            "retry-after": "0",
          })
          .end(geminiError(429, "RESOURCE_EXHAUSTED"));
        return;
      }
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      });
      const pageScript = pageScriptOf(parsed);
      const pageCall = pageScript ? PAGE_SCRIPTS[pageScript] : undefined;
      if (pageScript && pageCall) {
        response.end(
          event(
            carriesResult(parsed, pageCall.name) &&
              pageScript !== "[guion:bucle]"
              ? textChunk(PAGE_SCRIPT_ANSWER, true)
              : functionCallChunk(pageCall.name, pageCall.args),
          ),
        );
        return;
      }
      const factor = computedFactor(parsed);
      if (factor !== undefined) {
        response.end(event(textChunk(`La fuerza cambia ${factor}.`, true)));
        return;
      }
      if (asksForFactor(parsed)) {
        response.end(
          event(functionCallChunk("compute_force_factor", FACTOR_SCRIPT_INPUT)),
        );
        return;
      }
      if (script === "[guion:bloqueado]") {
        response.end(
          event({
            promptFeedback: { blockReason: "SAFETY" },
            usageMetadata: USAGE,
            responseId: "fake-response",
          }),
        );
        return;
      }
      if (script === "[guion:lento]") {
        await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
      }
      const finishReason =
        script === "[guion:longitud]" ? "MAX_TOKENS" : "STOP";
      const pending = [...holds].find(([key]) => body.includes(key))?.[1];
      for (const [index, text] of FAKE_ANSWER.entries()) {
        const last = index === FAKE_ANSWER.length - 1;
        if (last && pending) await pending;
        response.write(event(textChunk(text, last, finishReason)));
      }
      response.end();
      return;
    }
    // The model's own resource: the probe of /api/atomy/status.
    if (request.method === "GET" && /\/models\/[^/:]+$/.test(url.pathname)) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ name: url.pathname.slice(1) }));
      return;
    }
    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200).end("fake gemini");
      return;
    }
    response.writeHead(404).end();
  })();
});

// A test's request fixture keeps its connection open between control
// requests, and a test may spend longer than Node's default 5 s keep-alive
// between them (a __fail and its __recover with axe in between): the server
// would close the socket as the next request arrives on it (ECONNRESET).
server.keepAliveTimeout = 0;

server.listen(port, () => {
  console.log(`fake gemini on ${String(port)}`);
});
