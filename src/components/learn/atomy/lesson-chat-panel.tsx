"use client";

// The chat's panel on the lesson (lesson-chat.tsx loads it on its own, only
// in the advanced mode), with the lesson's surface, which reads the lesson
// controller and the predictions the reader makes in the lesson.

import { useContext, type ReactElement } from "react";
import type { ChatPanelProps } from "@/components/atomy/atomy-chat";
import { AtomyChatPanel } from "@/components/atomy/atomy-chat-panel";
import {
  PredictionBook,
  PredictionsContext,
} from "@/components/learn/atomy/chat-predictions";
import { lessonSurface } from "@/components/learn/atomy/lesson-surface";
import { useOptionalLessonController } from "@/components/learn/lesson-controller";

const NO_PREDICTIONS = new PredictionBook();

export default function LessonChatPanel(props: ChatPanelProps): ReactElement {
  const controller = useOptionalLessonController();
  const predictions = useContext(PredictionsContext) ?? NO_PREDICTIONS;
  return (
    <AtomyChatPanel
      {...props}
      surfaceFor={(context) => lessonSurface(controller, context, predictions)}
    />
  );
}
