// The page the chat with Atomy talks about, as the chat reaches it: the
// endpoint its questions go to, the snapshot each question carries and how
// the tools of the page run. Each
// surface builds its own: the lesson in learn/atomy/lesson-surface.ts, the
// orbit finder in gallery/finder/finder-surface.ts; the chat receives it from
// the page it is on (atomy-chat.tsx).

import type { SurfaceToolRunners } from "@/lib/atomy/surface-tools";

export interface ChatSurface {
  readonly api: string;
  /** What each request carries besides the messages; null when none can leave. */
  readonly snapshot: () => object | null;
  readonly tools: SurfaceToolRunners;
}
