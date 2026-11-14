"use client";

// The conversation with Atomy, without its panel: the transport that carries
// each question with the page's snapshot, the tools of the page the model
// calls, which run here through the surface (the lesson or the orbit
// finder) and go back by themselves up to MAX_AUTOMATIC_RESENDS times per
// question, and the conversation kept in the reader's progress, where there
// is one. A reload shows the conversation and its experiment as they were
// after the last finished answer. Each request carries only the latest
// messages that the route handler accepts (chat-window.ts), and the reader
// can start a new conversation.

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  safeValidateUIMessages,
} from "ai";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  endsWithPageTool,
  isBusy,
  viewOf,
  type ChatMessage,
  type ConversationView,
} from "@/components/atomy/chat-outcome";
import type { ChatSurface } from "@/components/atomy/chat-surface";
import { recentMessages } from "@/components/atomy/chat-window";
import { useProgress } from "@/components/shared/progress";
import { PREDICTION_IDS, type PredictionId } from "@/lib/lesson/predictions";
import type { PageToolResult } from "@/lib/atomy/chat-messages";
import { MAX_AUTOMATIC_RESENDS } from "@/lib/atomy/client-tools";
import {
  isSurfaceToolName,
  surfaceActionLine,
  type SurfaceToolName,
  type SurfaceToolTypes,
} from "@/lib/atomy/surface-tools";

const CONVERSATION_KEY = "chat";

/**
 * The experiment a conversation is about: its prediction, which tells one
 * experiment from another, and its question, which the reader and the model
 * read.
 */
export interface ExperimentContext {
  readonly prediction: PredictionId;
  readonly question: string;
}

const experimentContextSchema = z.strictObject({
  prediction: z.enum(PREDICTION_IDS),
  question: z.string().min(1),
});

/** The saved conversation; its messages are validated as the SDK's own. */
const savedConversationSchema = z.object({
  context: experimentContextSchema.optional(),
  messages: z.array(z.unknown()),
});

/** A call of a tool of the page, as the model made it. */
interface PageToolCall<Name extends SurfaceToolName> {
  readonly toolName: Name;
  readonly toolCallId: string;
  readonly input: SurfaceToolTypes[Name]["input"];
}

function isPageToolCall<Call extends { readonly toolName: string }>(
  call: Call,
): call is Extract<Call, { readonly toolName: SurfaceToolName }> {
  return isSurfaceToolName(call.toolName);
}

/** Where the transport, made once, reads the latest render's snapshot. */
class SnapshotSource {
  #read: () => object | null;

  constructor(read: () => object | null) {
    this.#read = read;
  }

  readWith(read: () => object | null): void {
    this.#read = read;
  }

  read(): object | null {
    return this.#read();
  }
}

export interface AtomyConversation extends ConversationView {
  /** The experiment the conversation is about, if any. */
  readonly context: ExperimentContext | undefined;
  /** An answer is on its way. */
  readonly busy: boolean;
  /** The line of Atomy's last change to the page. */
  readonly lastAction: string;
  /** Asks a question; false when it did not leave. */
  readonly send: (text: string) => boolean;
  /** Asks the last question again; false when it did not leave. */
  readonly retry: () => boolean;
  /** Stops the answer on its way, keeping its text so far. */
  readonly stop: () => void;
  /** Opens the conversation about `context`: another one starts anew. */
  readonly openWith: (context: ExperimentContext | undefined) => void;
  /** Starts a new conversation, about no experiment. */
  readonly reset: () => void;
}

/**
 * @param surfaceFor The page the chat talks about, with the experiment the
 * conversation is about; its endpoint is read once, when the chat mounts.
 */
export function useAtomyConversation(
  surfaceFor: (context: ExperimentContext | undefined) => ChatSurface,
): AtomyConversation {
  const store = useProgress()?.store ?? null;
  const [context, setContext] = useState<ExperimentContext | undefined>();
  const [lastAction, setLastAction] = useState("");
  const surface = surfaceFor(context);
  // The snapshot is read when each request leaves, the automatic resends
  // included. The transport lives as long as the chat, so it reads it through
  // a source each render points at its own surface.
  const readSnapshot = () => surface.snapshot();
  const [{ snapshotSource, transport }] = useState(() => {
    const source = new SnapshotSource(readSnapshot);
    return {
      snapshotSource: source,
      transport: new DefaultChatTransport<ChatMessage>({
        api: surface.api,
        body: () => source.read() ?? {},
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages: recentMessages(messages) },
        }),
      }),
    };
  });
  useEffect(() => {
    snapshotSource.readWith(readSnapshot);
  });
  /** The automatic resends of the reader's current question. */
  const resends = useRef(0);
  const chat = useChat<ChatMessage>({
    transport,
    sendAutomaticallyWhen: ({ messages }) => {
      if (
        !lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
        !endsWithPageTool(messages.at(-1)) ||
        resends.current >= MAX_AUTOMATIC_RESENDS
      )
        return false;
      resends.current += 1;
      return true;
    },
    // The tools of the page run here; the calculations ran on the server.
    onToolCall: async ({ toolCall }) => {
      if (toolCall.dynamic || !isPageToolCall(toolCall)) return;
      await run(toolCall);
    },
  });

  /** Runs the call on the page and sends its result back to the model. */
  async function run<Name extends SurfaceToolName>({
    toolName,
    toolCallId,
    input,
  }: PageToolCall<Name>) {
    const runTool: (
      input: SurfaceToolTypes[Name]["input"],
    ) => Promise<PageToolResult<SurfaceToolTypes[Name]["output"]>> =
      surface.tools[toolName];
    report(toolName, toolCallId, await runTool(input));
  }

  /** Sends a call's result back to the model; a change also gets its line. */
  function report<Name extends SurfaceToolName>(
    toolName: Name,
    toolCallId: string,
    result: PageToolResult<SurfaceToolTypes[Name]["output"]>,
  ) {
    if (result.ok)
      setLastAction(
        surfaceActionLine({
          type: `tool-${toolName}`,
          state: "output-available",
          output: result.output,
        }) ?? "",
      );
    void chat.addToolOutput(
      result.ok
        ? { tool: toolName, toolCallId, output: result.output }
        : {
            tool: toolName,
            toolCallId,
            state: "output-error",
            errorText: result.error,
          },
    );
  }

  // The saved conversation comes back once, on mount; until it has, the
  // empty one must not overwrite it.
  const [saved] = useState(() =>
    store
      ? savedConversationSchema.safeParse(store.get(CONVERSATION_KEY)).data
      : undefined,
  );
  const [restored, setRestored] = useState(saved === undefined);
  const { setMessages } = chat;
  useEffect(() => {
    if (!saved) return;
    let cancelled = false;
    void safeValidateUIMessages<ChatMessage>({
      messages: saved.messages,
    }).then((messages) => {
      if (cancelled) return;
      if (messages.success) {
        setContext(saved.context);
        setMessages(messages.data);
      }
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, [saved, setMessages]);

  const busy = isBusy(chat.status);

  /** Empties the conversation; the saved one follows between answers. */
  function startAnew(next: ExperimentContext | undefined) {
    if (busy) void chat.stop();
    resends.current = 0;
    setContext(next);
    chat.setMessages([]);
  }

  // Saved between answers: an answer cut by a reload is not kept.
  useEffect(() => {
    if (!store || !restored || busy) return;
    store.set(CONVERSATION_KEY, { context, messages: chat.messages });
  }, [store, restored, busy, context, chat.messages]);

  return {
    ...viewOf(chat, context?.question),
    context,
    busy,
    lastAction,
    send: (text) => {
      const question = text.trim();
      if (!question || busy || !snapshotSource.read()) return false;
      resends.current = 0;
      void chat.sendMessage({ text: question });
      return true;
    },
    retry: () => {
      if (!snapshotSource.read()) return false;
      resends.current = 0;
      void chat.regenerate();
      return true;
    },
    stop: () => {
      void chat.stop();
    },
    // Only another experiment starts anew: opening again from the corner or
    // from the same experiment keeps the visit's conversation, with the
    // experiment's question as the page words it now.
    openWith: (next) => {
      if (next?.prediction !== context?.prediction) {
        startAnew(next);
      } else if (next && next.question !== context?.question) {
        setContext(next);
      }
    },
    reset: () => {
      startAnew(undefined);
      setLastAction("");
    },
  };
}
