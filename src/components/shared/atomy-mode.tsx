"use client";

// The mode of the whole app: the advanced mode («modo con IA»), with Atomy
// talking through the language model (the lesson's chat and reasoning
// correction, the orbit finder's chat), or the reduced mode («modo reducido»),
// without it (AtomyModeChoice). The reader chooses it with
// the header's switch (atomy-mode-controls.tsx), off by default and kept in a
// cookie that the pages read on the server too. The advanced mode needs the
// model: without the key, without a connection in the browser, or with the
// key but the model out of reach (/api/atomy/status), the app goes on in the
// reduced mode, and the advanced mode comes back on its own once the model
// answers again: when the connection comes back, and, while the model is out
// of reach with the browser online, on retries spaced further apart each time
// and whenever the tab comes back to the foreground. The reader's choice of
// the reduced mode is one more reason for it, and the band names every
// reason that holds at once.
// A page that offers the advanced mode reads the mode on the server
// (lib/atomy/server-mode.ts) and seeds the provider with it through
// useAdvancedMode: without the key, the switch and the band know it before
// /api/atomy/status answers. Every other page knows it from the cookie the
// proxy sets without the key (src/proxy.ts), already on its first paint
// (atomy-mode-controls.tsx).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  readModeChoice,
  readNoKey,
  saveModeChoice,
  type AtomyModeChoice,
} from "@/components/atomy/atomy-cookie";
import { MODEL_STATUSES, type ModelStatus } from "@/lib/atomy/model-status";
import type { ServerMode } from "@/lib/atomy/server-mode";

export const STATUS_URL = "/api/atomy/status";

/**
 * Why the advanced mode is out of reach: the server has no key (ModelStatus
 * "no-key"), the server has it but cannot reach the model (ModelStatus
 * "unreachable"), or the browser has no connection.
 */
export type Unavailable = Exclude<ModelStatus, "available"> | "offline";

/**
 * Why the app runs in the reduced mode: the model's reasons, or the reader's
 * choice of the reduced mode ("chosen").
 */
export type ReducedReason = Unavailable | "chosen";

const REASON_TEXT: Record<ReducedReason, string> = {
  "no-key": "sin modelo de lenguaje configurado",
  unreachable: "sin respuesta del modelo de lenguaje",
  offline: "sin conexión con el modelo de lenguaje",
  chosen: "activado con el interruptor de la cabecera",
};

/** A list with at least one element. */
export type NonEmpty<T> = readonly [T, ...T[]];

/**
 * The reasons that hold, in a fixed order: the model's first. Null while
 * none does, and the app runs in the advanced mode.
 */
export function reducedReasons(
  unavailable: readonly Unavailable[],
  choice: AtomyModeChoice | null,
): NonEmpty<ReducedReason> | null {
  const reasons: ReducedReason[] =
    choice === "reduced" ? [...unavailable, "chosen"] : [...unavailable];
  const [first, ...rest] = reasons;
  return first === undefined ? null : [first, ...rest];
}

/** The band's text for the reasons that hold, all named. */
export function reducedModeNotice(reasons: NonEmpty<ReducedReason>): string {
  const [first, ...rest] = reasons;
  const listed = rest.reduce(
    (text, next, index) =>
      `${text}${index === rest.length - 1 ? " y " : ", "}${REASON_TEXT[next]}`,
    REASON_TEXT[first],
  );
  // Only the reader's choice can be undone from the switch right away; with
  // the model out of reach the switch is disabled.
  const undo =
    reasons.length === 1 && reasons[0] === "chosen"
      ? " Puedes desactivarlo en cualquier momento."
      : "";
  return `Modo reducido: ${listed}.${undo} Atomy sigue guiando los experimentos sin IA.`;
}

export interface AtomyMode {
  /** The reader's choice; null until the page is hydrated. */
  readonly choice: AtomyModeChoice | null;
  /** Why the advanced mode is out of reach; empty while it is not. */
  readonly unavailable: readonly Unavailable[];
  readonly choose: (choice: AtomyModeChoice) => void;
  /** Asks again whether the model answers, after a call to it failed. */
  readonly recheck: () => void;
  /** Takes what the server knew of the mode, until the status answers. */
  readonly seed: (server: ServerMode) => void;
}

const NO_MODE: AtomyMode = {
  choice: null,
  unavailable: [],
  choose: () => undefined,
  recheck: () => undefined,
  seed: () => undefined,
};

const AtomyModeContext = createContext<AtomyMode>(NO_MODE);

const choiceListeners = new Set<() => void>();

function subscribeChoice(listener: () => void): () => void {
  choiceListeners.add(listener);
  return () => {
    choiceListeners.delete(listener);
  };
}

function subscribeNothing(): () => void {
  return () => undefined;
}

function subscribeConnection(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** The waits between retries while the model is out of reach; the last repeats. */
export const RETRY_DELAYS_MS = [5_000, 15_000, 60_000] as const;

// A check by hand rather than zod: this provider is in the root layout, and
// zod would ship to every page for a body of one field.
function isModelStatus(value: unknown): value is ModelStatus {
  return MODEL_STATUSES.some((status) => status === value);
}

function statusOfBody(body: unknown): ModelStatus | null {
  if (typeof body !== "object" || body === null || !("status" in body)) {
    return null;
  }
  return isModelStatus(body.status) ? body.status : null;
}

function choose(choice: AtomyModeChoice): void {
  saveModeChoice(choice);
  for (const listener of choiceListeners) listener();
}

async function fetchStatus(fresh: boolean): Promise<ModelStatus | null> {
  try {
    const response = await fetch(fresh ? `${STATUS_URL}?fresh` : STATUS_URL, {
      cache: "no-store",
    });
    return statusOfBody(await response.json());
  } catch {
    // Without an answer, the browser's connection says the rest.
    return null;
  }
}

export function AtomyModeProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const choice = useSyncExternalStore<AtomyModeChoice | null>(
    subscribeChoice,
    () => readModeChoice(document.cookie),
    () => null,
  );
  const online = useSyncExternalStore(
    subscribeConnection,
    () => navigator.onLine,
    () => true,
  );
  // Only the server sets it, with the page: it does not change while open.
  const keyless = useSyncExternalStore(
    subscribeNothing,
    () => readNoKey(document.cookie),
    () => false,
  );
  const [status, setStatus] = useState<ModelStatus | null>(null);
  // Questions can overlap (the connection comes back while a retry is out):
  // only the answer to the last one asked is applied, so an older one that
  // comes in late does not undo a newer one.
  const lastAsked = useRef(0);

  const ask = useCallback(async (fresh: boolean): Promise<void> => {
    lastAsked.current += 1;
    const asked = lastAsked.current;
    const next = await fetchStatus(fresh);
    if (asked === lastAsked.current && next !== null) setStatus(next);
  }, []);

  const probe = useCallback(
    (fresh: boolean) => {
      void ask(fresh);
    },
    [ask],
  );

  // On load, and again whenever the connection comes back.
  useEffect(() => {
    if (online) probe(false);
  }, [online, probe]);

  // While the server cannot reach the model and the browser is online, no
  // event would ask again: retry, each time later, and as soon as the tab is
  // back in the foreground. A new status ends the loop.
  useEffect(() => {
    if (!online || status !== "unreachable") return;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let asking = false;
    const check = async (): Promise<void> => {
      // One question at a time: the tab may come back while one is out.
      if (asking) return;
      asking = true;
      clearTimeout(timer);
      await ask(true);
      asking = false;
      if (stopped) return;
      schedule();
    };
    const schedule = (): void => {
      const delay =
        RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
      attempt += 1;
      timer = setTimeout(() => void check(), delay);
    };
    const onVisible = (): void => {
      if (document.visibilityState !== "visible") return;
      attempt = 0;
      void check();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [online, status, ask]);

  // The last known status still holds while the browser is offline; until
  // the first one answers, the proxy's cookie tells whether there is a key.
  const unavailable: Unavailable[] = [];
  if (status === null ? keyless : status === "no-key") {
    unavailable.push("no-key");
  }
  // Offline, the browser's connection is the reason, whatever the server
  // last answered.
  if (!online) unavailable.push("offline");
  else if (status === "unreachable") unavailable.push("unreachable");

  const recheck = useCallback(() => {
    probe(true);
  }, [probe]);

  const seed = useCallback((server: ServerMode) => {
    // The status's answer, once in, is the newer word.
    if (!server.modelConfigured) setStatus((known) => known ?? "no-key");
  }, []);

  const value: AtomyMode = {
    choice,
    unavailable,
    choose,
    recheck,
    seed,
  };
  return (
    <AtomyModeContext.Provider value={value}>
      {children}
    </AtomyModeContext.Provider>
  );
}

export function useAtomyMode(): AtomyMode {
  return useContext(AtomyModeContext);
}

/**
 * Whether a page runs in the advanced mode: the server has the key, the
 * reader prefers it (the cookie as the server read it, until hydration) and
 * nothing keeps the model out of reach. Seeds the provider with the server's
 * mode before the first paint.
 */
export function useAdvancedMode(server: ServerMode): boolean {
  const { choice, unavailable, seed } = useAtomyMode();
  const { modelConfigured, choice: choiceOnServer } = server;
  useLayoutEffect(() => {
    seed({ modelConfigured, choice: choiceOnServer });
  }, [seed, modelConfigured, choiceOnServer]);
  return (
    modelConfigured &&
    (choice ?? choiceOnServer) === "ia" &&
    unavailable.length === 0
  );
}
