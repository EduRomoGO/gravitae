"use client";

// The chat with Atomy on the lesson: the chat of every surface
// (components/atomy/atomy-chat.tsx) with the lesson's panel
// (lesson-chat-panel.tsx), loaded only in the advanced mode, and the book of
// the predictions the reader makes in the lesson, which the panel reads.
// It also gives the lesson its mode (lesson/lesson-mode), so the predictions
// read the mode from it and not from whether the chat opens.

import dynamic from "next/dynamic";
import { useState, type ReactElement, type ReactNode } from "react";
import { AtomyChat } from "@/components/atomy/atomy-chat";
import {
  PredictionBook,
  PredictionsContext,
} from "@/components/learn/atomy/chat-predictions";
import { LessonModeProvider } from "@/components/learn/lesson/lesson-mode";

const LessonChatPanel = dynamic(
  () => import("@/components/learn/atomy/lesson-chat-panel"),
);

export function LessonChat({
  children,
  enabled = true,
}: {
  children: ReactNode;
  /** The advanced mode is on: the chat shows. */
  enabled?: boolean;
}): ReactElement {
  const [predictions] = useState(() => new PredictionBook());
  return (
    <PredictionsContext.Provider value={predictions}>
      <LessonModeProvider mode={enabled ? "ia" : "reduced"}>
        <AtomyChat enabled={enabled} panel={LessonChatPanel}>
          {children}
        </AtomyChat>
      </LessonModeProvider>
    </PredictionsContext.Provider>
  );
}
