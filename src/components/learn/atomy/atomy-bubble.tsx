"use client";

// Atomy inside a speech bubble: it talks for a moment when the bubble
// appears and then idles. `after` goes under the bubble, in its column, for
// the reader's reply buttons. With `onAvatarClick` the avatar is a button
// labelled `avatarLabel`. The avatar carries data-atomy-avatar so a page can
// find where Atomy is.

import type { ReactElement, ReactNode } from "react";
import { INTERFACE } from "@/components/learn/lesson/lesson-sections-dom";
import { Atomy, useTalkThenIdle } from "@/components/atomy/atomy";

export function AtomyBubble({
  children,
  after,
  avatarClassName = "h-12 w-12",
  role,
  onAvatarClick,
  avatarLabel,
}: {
  children: ReactNode;
  after?: ReactNode;
  avatarClassName?: string;
  role?: "status";
  onAvatarClick?: () => void;
  avatarLabel?: string;
}): ReactElement {
  const state = useTalkThenIdle();
  const avatar = <Atomy state={state} className={avatarClassName} />;
  // The avatar sits inside the bubble, floated left: the text beside it is
  // short, and what follows takes the whole width.
  const avatarSlot = onAvatarClick ? (
    <button
      type="button"
      data-atomy-avatar
      aria-label={avatarLabel}
      onClick={onAvatarClick}
      className="float-left mr-3 mb-1 rounded-full ring-violet-300 hover:ring-2 dark:ring-violet-800"
    >
      {avatar}
    </button>
  ) : (
    <span data-atomy-avatar className="float-left mr-3 mb-1 block">
      {avatar}
    </span>
  );
  return (
    <div role={role} className="space-y-3">
      <div className="flow-root rounded-2xl border border-violet-300 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/40">
        {avatarSlot}
        <p
          {...INTERFACE}
          className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300"
        >
          Atomy
        </p>
        <div className="mt-1 space-y-2">{children}</div>
      </div>
      {after}
    </div>
  );
}
