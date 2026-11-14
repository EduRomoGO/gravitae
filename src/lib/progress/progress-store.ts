// The reader's progress through a lesson, kept in the browser's localStorage
// so that reloading the page goes on where the reader was. One entry per
// lesson, the same for both modes, holds a JSON object of values by key; each value is
// validated by whoever reads it, since an entry may come from an older
// version of the lesson. A storage that fails (a private window, blocked site
// data) leaves the progress in memory only: the lesson still works, and a
// reload starts it over.
// The entry's prefix carries the version of the progress's shape: a version
// that changes what the values mean starts every lesson over, instead of
// reading the older values as if they meant the same.
// A change reaches the readers at once but the storage later, in one write
// for all the changes in between, when the browser is idle or the page is
// hidden: the entry holds the whole conversation with Atomy, and serializing
// it on every change of section while scrolling would grow with it.

const PREFIX = "gravitae:progreso:v3:";
/** The prefixes of older versions, forgotten with a lesson's progress. */
const OLDER_PREFIXES = [
  "gravitae:progreso:v2:",
  "gravitae:progreso:",
] as const;

export interface ProgressStore {
  /** The value saved under `key`, unvalidated; the same object until set again. */
  readonly get: (key: string) => unknown;
  readonly set: (key: string, value: unknown) => void;
  readonly subscribe: (listener: () => void) => () => void;
  /** Forgets every value of this store. */
  readonly clear: () => void;
}

export function progressStorageKey(lesson: string): string {
  return `${PREFIX}${lesson}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** How long a change may wait for the browser to be idle before it is written. */
const IDLE_TIMEOUT_MS = 1000;

/** Calls `callback` when the browser is idle; returns a function that cancels it. */
function whenIdle(callback: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS });
    return () => {
      cancelIdleCallback(id);
    };
  }
  const id = setTimeout(callback, 0);
  return () => {
    clearTimeout(id);
  };
}

interface PendingWrite {
  readonly write: () => void;
  /** Forgets the changes waiting, leaving the storage as it is. */
  readonly drop: () => void;
}

/**
 * The writes waiting for the browser, by entry: a store that loads an entry
 * writes the pending changes of another store of it first, and forgetting a
 * lesson's progress drops them.
 */
const pendingWrites = new Map<string, PendingWrite>();

/**
 * Drops every write waiting, leaving the storage as it is. For the tests,
 * which empty localStorage between them: a write left from one test must not
 * reach the next.
 */
export function dropPendingProgressWrites(): void {
  for (const pending of [...pendingWrites.values()]) pending.drop();
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function createProgressStore(
  storageKey: string,
  storage: () => Storage | undefined = browserStorage,
): ProgressStore {
  let values: Record<string, unknown> | null = null;
  const listeners = new Set<() => void>();

  /** Cancels the scheduled write, while one waits. */
  let cancelPending: (() => void) | null = null;

  function load(): Record<string, unknown> {
    if (values !== null) return values;
    pendingWrites.get(storageKey)?.write();
    let read: unknown = null;
    try {
      const raw = storage()?.getItem(storageKey);
      if (raw) read = JSON.parse(raw);
    } catch {
      read = null;
    }
    values = isRecord(read) ? read : {};
    return values;
  }

  function stopWaiting() {
    if (!cancelPending) return;
    const cancel = cancelPending;
    cancelPending = null;
    if (pendingWrites.get(storageKey) === handle)
      pendingWrites.delete(storageKey);
    cancel();
  }

  function write() {
    stopWaiting();
    try {
      storage()?.setItem(storageKey, JSON.stringify(values ?? {}));
    } catch {
      // The progress stays in memory.
    }
  }

  const handle: PendingWrite = { write, drop: stopWaiting };

  function writeLater() {
    if (cancelPending) return;
    if (typeof window === "undefined") {
      write();
      return;
    }
    const onHidden = () => {
      if (document.visibilityState === "hidden") write();
    };
    const cancelIdle = whenIdle(write);
    window.addEventListener("pagehide", write);
    document.addEventListener("visibilitychange", onHidden);
    cancelPending = () => {
      cancelIdle();
      window.removeEventListener("pagehide", write);
      document.removeEventListener("visibilitychange", onHidden);
    };
    pendingWrites.set(storageKey, handle);
  }

  function save(next: Record<string, unknown>) {
    values = next;
    writeLater();
    for (const listener of listeners) listener();
  }

  return {
    get: (key) => load()[key],
    set: (key, value) => {
      save({ ...load(), [key]: value });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear: () => {
      stopWaiting();
      values = {};
      try {
        storage()?.removeItem(storageKey);
      } catch {
        // Nothing was saved.
      }
      for (const listener of listeners) listener();
    },
  };
}

/**
 * Forgets the progress of `lesson`, with the entries of older versions of
 * the progress and the entries per mode that older versions of the lesson
 * kept under it.
 */
export function clearLessonProgress(
  lesson: string,
  storage: () => Storage | undefined = browserStorage,
): void {
  const entries = [PREFIX, ...OLDER_PREFIXES].map(
    (prefix) => `${prefix}${lesson}`,
  );
  for (const entry of entries) pendingWrites.get(entry)?.drop();
  try {
    const store = storage();
    if (!store) return;
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (
        key !== null &&
        entries.some((entry) => key === entry || key.startsWith(`${entry}:`))
      )
        keys.push(key);
    }
    for (const key of keys) store.removeItem(key);
  } catch {
    // Nothing could be saved either.
  }
}
