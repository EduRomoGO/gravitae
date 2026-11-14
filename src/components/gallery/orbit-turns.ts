"use client";

// The gallery's cards draw their orbits one at a time, each in a task of
// its own: a card's first drawing integrates its lap (lib/orbits/cache.ts)
// and renders its drawing, and six of them in one task blocked the main
// thread for half a second on a phone. Between two cards the browser gets
// its turn, so a tap is answered in the meantime. Every card still draws at
// load, in the order the page mounts them.

import { useEffect, useRef, useState } from "react";

// A task of its own through a message, not a timer: a message is not
// throttled like a timer in a background tab, nor held by a clock that
// stands still.
function inNextTask(callback: () => void): void {
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    channel.port1.close();
    callback();
  };
  channel.port2.postMessage(null);
}

interface Request {
  readonly grant: () => void;
}

const waiting: Request[] = [];
let current: Request | null = null;
/** A card holds the turn, or the next one waits for its own task. */
let busy = false;

function grantNext(): void {
  current = waiting.shift() ?? null;
  busy = current !== null;
  current?.grant();
}

interface Turn {
  /** The card has drawn: the next one goes in a task of its own. */
  readonly end: () => void;
  /** The card leaves before or during its turn. */
  readonly cancel: () => void;
}

function requestTurn(grant: () => void): Turn {
  const request: Request = { grant };
  waiting.push(request);
  if (!busy) grantNext();
  const end = (): void => {
    if (current !== request) return;
    current = null;
    inNextTask(grantNext);
  };
  return {
    end,
    cancel: () => {
      const index = waiting.indexOf(request);
      if (index !== -1) waiting.splice(index, 1);
      end();
    },
  };
}

/**
 * Whether this card may draw its orbit now, and the call that tells, once
 * it has drawn, that the next card can go.
 */
export function useOrbitTurn(): { granted: boolean; drawn: () => void } {
  const [granted, setGranted] = useState(false);
  const turn = useRef<Turn | null>(null);
  useEffect(() => {
    const requested = requestTurn(() => {
      setGranted(true);
    });
    turn.current = requested;
    return requested.cancel;
  }, []);
  return {
    granted,
    drawn: () => {
      turn.current?.end();
    },
  };
}
