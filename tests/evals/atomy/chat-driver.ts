// Plays the page's side of the chat against the production route handler:
// posts the reader's question with the snapshot, reads the UI message
// stream, runs the page's tools the way the lesson does (a widget ends as it
// was set) and resends,
// as useChat does, up to the chat's own limit of automatic resends.

import {
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { z } from "zod";
import type { ChatSnapshot } from "@/lib/atomy/chat-request";
import {
  PAGE_TOOL_NAMES,
  MAX_AUTOMATIC_RESENDS,
} from "@/lib/atomy/client-tools";
import { widgetChange } from "@/lib/lesson/widgets";

export interface ToolCall {
  name: string;
  input: unknown;
  /** Whether the call fit its schema and ran. */
  valid: boolean;
}

export interface ChatTurn {
  /** Atomy's whole answer: every text part of the turn, joined. */
  text: string;
  toolCalls: ToolCall[];
  /** The stream's or the response's error, if the turn failed. */
  error: string | undefined;
  /** The conversation with the turn's answer, for the next question. */
  messages: UIMessage[];
  snapshot: ChatSnapshot;
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/atomy/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The UI message chunks of the handler's server-sent events. */
function chunksOf(body: NonNullable<Response["body"]>, errors: string[]) {
  // The same parsing and validation the chat's transport applies.
  return parseJsonEventStream({
    stream: body,
    schema: uiMessageChunkSchema,
  }).pipeThrough(
    new TransformStream({
      transform(
        result,
        controller: TransformStreamDefaultController<UIMessageChunk>,
      ) {
        if (!result.success) throw result.error;
        const chunk = result.value;
        if (chunk.type === "error") errors.push(chunk.errorText);
        controller.enqueue(chunk);
      },
    }),
  );
}

type Part = UIMessage["parts"][number];

function isPageToolName(name: string): boolean {
  return PAGE_TOOL_NAMES.some((tool) => tool === name);
}

function toolNameOf(part: Part): string | null {
  if (part.type === "dynamic-tool") return part.toolName;
  return part.type.startsWith("tool-") ? part.type.slice(5) : null;
}

/** What the page answers to each of its tools. */
function pageOutput(
  name: string,
  input: Record<string, unknown>,
  titles: Readonly<Record<string, string>>,
): unknown {
  switch (name) {
    case "go_to_section": {
      const section = String(input.section);
      return { section, title: titles[section] ?? section };
    }
    default:
      return input;
  }
}

/** The snapshot as the page leaves it after its tools ran. */
function snapshotAfter(snapshot: ChatSnapshot, calls: ToolCall[]) {
  let next = snapshot;
  for (const { name, input, valid } of calls) {
    if (!valid) continue;
    const change = widgetChange.safeParse(input);
    if (name === "set_widget" && change.success) {
      next = {
        ...next,
        widgets: next.widgets.map((widget) =>
          widget.widget === change.data.widget ? change.data : widget,
        ),
      };
    }
  }
  return next;
}

export async function chatTurn({
  handle,
  messages,
  question,
  snapshot,
  titles,
}: {
  handle: (request: Request) => Promise<Response>;
  messages: readonly UIMessage[];
  question: string;
  snapshot: ChatSnapshot;
  titles: Readonly<Record<string, string>>;
}): Promise<ChatTurn> {
  const history: UIMessage[] = [
    ...messages,
    {
      id: `u${String(messages.length)}`,
      role: "user",
      parts: [{ type: "text", text: question }],
    },
  ];
  let current = snapshot;
  let answer: UIMessage | undefined;
  const errors: string[] = [];
  const toolCalls = new Map<string, ToolCall>();
  for (let resend = 0; resend <= MAX_AUTOMATIC_RESENDS; resend += 1) {
    const response = await handle(
      post({
        messages: answer ? [...history, answer] : history,
        snapshot: current,
      }),
    );
    if (response.status !== 200 || !response.body) {
      errors.push(`HTTP ${String(response.status)}`);
      break;
    }
    const stream = chunksOf(response.body, errors);
    for await (const message of readUIMessageStream({
      stream,
      ...(answer ? { message: answer } : {}),
    })) {
      answer = message;
    }
    if (errors.length > 0 || !answer) break;
    const pending: ToolCall[] = [];
    answer = {
      ...answer,
      parts: answer.parts.map((part): Part => {
        const name = toolNameOf(part);
        if (!name || !("state" in part) || !("toolCallId" in part)) {
          return part;
        }
        const id = part.toolCallId;
        if (part.state === "output-error" && !toolCalls.has(id)) {
          toolCalls.set(id, { name, input: part.input, valid: false });
        }
        if (part.state === "output-available" && !toolCalls.has(id)) {
          toolCalls.set(id, { name, input: part.input, valid: true });
        }
        if (part.state !== "input-available" || !isPageToolName(name)) {
          return part;
        }
        const input = z.record(z.string(), z.unknown()).parse(part.input);
        const call = { name, input, valid: true };
        toolCalls.set(id, call);
        pending.push(call);
        return {
          ...part,
          state: "output-available",
          output: pageOutput(name, input, titles),
        };
      }),
    };
    if (pending.length === 0) break;
    current = snapshotAfter(current, pending);
  }
  const text = (answer?.parts ?? [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
  return {
    text,
    toolCalls: [...toolCalls.values()],
    error: errors.length > 0 ? errors.join("; ") : undefined,
    messages: answer ? [...history, answer] : history,
    snapshot: current,
  };
}
