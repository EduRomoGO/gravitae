// The log of each request kept on disk, so it survives restarts of `next dev`
// (which empties its own log file on every start) and can be compared across
// sessions. One file per local day, one JSON line per event, each with the
// wall-clock time it was written. Read them with `npm run atomy-logs`.

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { consoleLogSink, type AtomyLogSink } from "@/lib/atomy/request-log";

/** Where the development log is kept, relative to the app's directory. */
export const ATOMY_LOG_DIR = join("logs", "atomy");

function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Appends each line, with its time as `at`, to `<dir>/<YYYY-MM-DD>.jsonl`. */
export function fileLogSink(
  dir: string,
  now: () => Date = () => new Date(),
): AtomyLogSink {
  return (line) => {
    const at = now();
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      join(dir, `${localDay(at)}.jsonl`),
      `${JSON.stringify({ at: at.toISOString(), ...line })}\n`,
    );
  };
}

/** The development log: the server's console and the files on disk. */
export function devLogSink(
  dir: string = join(process.cwd(), ATOMY_LOG_DIR),
): AtomyLogSink {
  const file = fileLogSink(dir);
  return (line) => {
    consoleLogSink(line);
    file(line);
  };
}
