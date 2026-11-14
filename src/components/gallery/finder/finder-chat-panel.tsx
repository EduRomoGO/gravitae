"use client";

// The chat's panel on the finder (finder-app.tsx loads it on its own, only
// in the advanced mode), which operates the finder's controller.

import type { ReactElement } from "react";
import type { ChatPanelProps } from "@/components/atomy/atomy-chat";
import { AtomyChatPanel } from "@/components/atomy/atomy-chat-panel";
import { useOptionalFinder } from "@/components/gallery/finder/finder-controller";
import { finderSurface } from "@/components/gallery/finder/finder-surface";

export default function FinderChatPanel(props: ChatPanelProps): ReactElement {
  const finder = useOptionalFinder();
  return <AtomyChatPanel {...props} surfaceFor={() => finderSurface(finder)} />;
}
