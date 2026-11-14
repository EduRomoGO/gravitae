"use client";

// The header's switch of the reduced mode and the band, below the header,
// that tells the reader the app runs in the reduced mode and every reason
// for it (atomy-mode.tsx): the model out of reach, the reader's choice, or
// both. Without the model the switch shows on and cannot be turned off; the
// band describes it.
// The band goes in the flow, between the header and the page: it has to be
// in the first paint, or it pushes the whole page down when it comes in.
// The server's HTML cannot hold it, since most pages are built once and the
// reasons are the reader's: until the page is hydrated, an inline script
// draws it from the same sources the provider reads (the cookies and the
// browser's connection). Only the server's failure to reach the model, which
// takes a request to know, comes in later.

import type { ReactElement } from "react";
import {
  ATOMY_MODE_COOKIE,
  ATOMY_NO_KEY_COOKIE,
  REDUCED_MODE,
  NO_KEY,
} from "@/components/atomy/atomy-cookie";
import {
  reducedModeNotice,
  reducedReasons,
  type NonEmpty,
  type ReducedReason,
  useAtomyMode,
} from "@/components/shared/atomy-mode";
import { InlineScript } from "@/components/shared/inline-script";
import { FOCUS_RING_CLASS } from "@/components/shared/link-class";

const REDUCED_NOTICE_ID = "atomy-modo-reducido";
const EARLY_BAND_ID = "atomy-modo-reducido-previo";
const BAND_CLASS =
  "border-b border-amber-600 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-100";

export function AtomyModeSwitch(): ReactElement {
  const { choice, unavailable, choose } = useAtomyMode();
  const reduced = unavailable.length > 0;
  const on = reduced || choice === "reduced";
  const described = reducedReasons(unavailable, choice) !== null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      // aria-disabled, not disabled: the switch stays in the tab order, so a
      // keyboard or screen reader reaches it and the reason it describes.
      aria-disabled={reduced || undefined}
      aria-describedby={described ? REDUCED_NOTICE_ID : undefined}
      onClick={() => {
        if (!reduced) choose(on ? "ia" : "reduced");
      }}
      // Hidden, keeping its room, until the reader's choice is known.
      className={`inline-flex items-center gap-2 rounded-full py-1 pr-1 pl-2 font-medium text-slate-700 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 dark:text-slate-200 ${FOCUS_RING_CLASS} ${choice === null ? "invisible" : ""}`}
    >
      Modo reducido
      <span
        aria-hidden="true"
        className={`relative inline-block h-5 w-9 rounded-full transition-colors ${on ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-600"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${on ? "translate-x-4" : ""}`}
        />
      </span>
    </button>
  );
}

export function ReducedModeBand(): ReactElement {
  const { choice, unavailable } = useAtomyMode();
  const reasons = reducedReasons(unavailable, choice);
  return (
    <>
      {/* The reader's choice is known from the first render after the
          hydration: the band below takes over in that same commit. */}
      {choice === null && <EarlyBand />}
      <div role="status">
        {reasons && (
          <p id={REDUCED_NOTICE_ID} className={BAND_CLASS}>
            {reducedModeNotice(reasons)}
          </p>
        )}
      </div>
    </>
  );
}

/** Every combination of the reasons the page knows before it is hydrated. */
const EARLY_REASONS: readonly NonEmpty<ReducedReason>[] = [
  ["no-key"],
  ["offline"],
  ["chosen"],
  ["no-key", "offline"],
  ["no-key", "chosen"],
  ["offline", "chosen"],
  ["no-key", "offline", "chosen"],
];

/**
 * The band as the inline script draws it, in the order of reducedReasons:
 * without the key (the proxy's cookie), without a connection, and the
 * reader's choice (its cookie).
 */
export function earlyBandScript(): string {
  const notices = Object.fromEntries(
    EARLY_REASONS.map((reasons) => [
      reasons.join(),
      reducedModeNotice(reasons),
    ]),
  );
  const has = (name: string, value: string): string =>
    `c.indexOf(${JSON.stringify(`${name}=${value}`)})>=0`;
  return `(function(){var c=document.cookie.split(";").map(function(p){return p.trim()}),r=[];if(${has(ATOMY_NO_KEY_COOKIE, NO_KEY)})r.push("no-key");if(!navigator.onLine)r.push("offline");if(${has(ATOMY_MODE_COOKIE, REDUCED_MODE)})r.push("chosen");var t=${JSON.stringify(notices)}[r.join()];if(!t)return;var p=document.createElement("p");p.className=${JSON.stringify(BAND_CLASS)};p.textContent=t;document.getElementById(${JSON.stringify(EARLY_BAND_ID)}).appendChild(p)})()`;
}

/**
 * Where the inline script draws the band in the server's HTML. React does
 * not compare what it holds when it hydrates (dangerouslySetInnerHTML), and
 * removes it in the first render after the hydration, the one that reads the
 * reader's choice.
 */
function EarlyBand(): ReactElement {
  return (
    <>
      <div
        id={EARLY_BAND_ID}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: "" }}
      />
      <InlineScript code={earlyBandScript()} />
    </>
  );
}
