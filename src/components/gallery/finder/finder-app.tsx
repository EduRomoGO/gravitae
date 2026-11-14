"use client";

// The finder with its controller, calculating in a Web Worker, and, in the
// advanced mode (components/shared/atomy-mode.tsx), the chat with Atomy,
// which operates the same controller. The chat's panel
// (finder-chat-panel.tsx) is loaded only in the advanced mode.

import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import { AtomyChat } from "@/components/atomy/atomy-chat";
import { useAdvancedMode } from "@/components/shared/atomy-mode";
import { Finder } from "@/components/gallery/finder/finder";
import { FinderProvider } from "@/components/gallery/finder/finder-controller";
import type { ServerMode } from "@/lib/atomy/server-mode";
import { workerSearcher } from "@/lib/orbits/search-client";

const FinderChatPanel = dynamic(
  () => import("@/components/gallery/finder/finder-chat-panel"),
);

export function FinderApp({
  serverMode,
}: {
  /** The mode as the server read it for this request. */
  serverMode: ServerMode;
}): ReactElement {
  const advanced = useAdvancedMode(serverMode);
  return (
    <FinderProvider searcher={workerSearcher}>
      <AtomyChat enabled={advanced} panel={FinderChatPanel}>
        <Finder />
      </AtomyChat>
    </FinderProvider>
  );
}
