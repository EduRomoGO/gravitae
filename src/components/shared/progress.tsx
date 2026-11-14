"use client";

// The reader's progress as React sees it: a provider with the store of the
// lesson and mode, and a hook that keeps a piece of state in it, so that
// reloading the page goes on where the reader was. Outside a provider, or
// under <WithoutProgress>, the state is the component's own and nothing is
// remembered.
// The server renders the initial values: the saved ones arrive right after
// hydration, so the first render matches the server's.

import {
  createContext,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import type { z } from "zod";
import type { ProgressStore } from "@/lib/progress/progress-store";

interface Progress {
  readonly store: ProgressStore;
  /** The page opened on the lesson: it goes back to the section the reader was in. */
  readonly restoreScroll: boolean;
}

const ProgressContext = createContext<Progress | null>(null);

export function ProgressProvider({
  store,
  restoreScroll,
  children,
}: {
  store: ProgressStore;
  restoreScroll: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <ProgressContext.Provider value={{ store, restoreScroll }}>
      {children}
    </ProgressContext.Provider>
  );
}

/** Its children's state is their own, not the reader's progress. */
export function WithoutProgress({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <ProgressContext.Provider value={null}>{children}</ProgressContext.Provider>
  );
}

/** The progress around, or null where nothing is remembered. */
export function useProgress(): Progress | null {
  return useContext(ProgressContext);
}

const noSubscription = () => () => undefined;

/**
 * State kept in the lesson's progress under `key`, validated by `schema`
 * (which must keep its identity across renders). A saved value the schema
 * rejects counts as none. Without a key or a progress, it is plain state.
 * Updates are functions of the current value, read from the store, so two in
 * the same tick add up.
 */
export function usePersistentState<T>(
  key: string | undefined,
  initial: T,
  schema: z.ZodType<T>,
): [T, (update: (current: T) => T) => void] {
  const progress = useContext(ProgressContext);
  const store = key === undefined ? null : (progress?.store ?? null);
  const [own, setOwn] = useState(initial);
  const initialRef = useRef(initial);
  const raw = useSyncExternalStore(
    store ? store.subscribe : noSubscription,
    () => (store && key !== undefined ? store.get(key) : undefined),
    () => undefined,
  );
  const update = (next: (current: T) => T) => {
    if (store && key !== undefined) {
      const current = schema.safeParse(store.get(key));
      store.set(key, next(current.success ? current.data : initialRef.current));
    } else {
      setOwn(next);
    }
  };
  if (!store) return [own, update];
  const saved = raw === undefined ? undefined : schema.safeParse(raw);
  return [saved?.success ? saved.data : initial, update];
}
