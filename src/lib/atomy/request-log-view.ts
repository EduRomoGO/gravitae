// Reads the development log written by request-log-file.ts and renders it for
// the terminal: one row per request, or every event of one request with its
// input and raw outputs. Used by scripts/atomy-logs.mts; it imports nothing at
// runtime so Node runs it without a bundler: the import below is a type's,
// which Node strips.

import type { AtomyLogLine } from "@/lib/atomy/request-log";

/** A line as request-log-file.ts writes it: the event and when it was written. */
type WrittenLogLine = AtomyLogLine & { at: string };

/** Every field of any line of the log. */
type LogKey = WrittenLogLine extends infer Line
  ? Line extends unknown
    ? keyof Line
    : never
  : never;

/** The fields of any line of the log whose value is a `Value`. */
type KeyWith<Value, Line = WrittenLogLine> = Line extends unknown
  ? {
      [Key in keyof Line]-?: Line[Key] extends Value | undefined ? Key : never;
    }[keyof Line]
  : never;

/**
 * One event of the log as read from disk: loosely typed, validated by use.
 * Its fields are read by the names the log writes (LogKey), so renaming a
 * field in request-log.ts breaks the view's build.
 */
export type StoredLogLine = Record<string, unknown> & {
  atomy: string;
  requestId: string;
  event: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredLogLine(value: unknown): value is StoredLogLine {
  return (
    isRecord(value) &&
    typeof value.atomy === "string" &&
    typeof value.requestId === "string" &&
    typeof value.event === "string"
  );
}

/** The log lines of a JSONL text; blank and foreign lines are skipped. */
export function parseLogLines(text: string): StoredLogLine[] {
  return text.split("\n").flatMap((raw) => {
    if (raw.trim() === "") return [];
    try {
      const value: unknown = JSON.parse(raw);
      return isStoredLogLine(value) ? [value] : [];
    } catch {
      return [];
    }
  });
}

/** The lines grouped by request, in the order the requests started. */
export function groupByRequest(
  lines: StoredLogLine[],
): Map<string, StoredLogLine[]> {
  const groups = new Map<string, StoredLogLine[]>();
  for (const line of lines) {
    const group = groups.get(line.requestId);
    if (group) group.push(line);
    else groups.set(line.requestId, [line]);
  }
  return groups;
}

export interface RequestSummary {
  requestId: string;
  at: string | undefined;
  atomy: string;
  promptVersion: string | undefined;
  status: number | undefined;
  error: string | undefined;
  /** Attempts of the correction or steps of the chat. */
  calls: number;
  sdkRetries: number | undefined;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  reasoningTokens: number | undefined;
  firstChunkMs: number | undefined;
  totalMs: number | undefined;
}

function text(line: StoredLogLine | undefined, key: KeyWith<string>) {
  const value = line?.[key];
  return typeof value === "string" ? value : undefined;
}

function count(line: StoredLogLine | undefined, key: KeyWith<number>) {
  const value = line?.[key];
  return typeof value === "number" ? value : undefined;
}

export function summarizeRequest(lines: StoredLogLine[]): RequestSummary {
  const first = lines[0];
  const request = lines.find(({ event }) => event === "request");
  const response = lines.find(({ event }) => event === "response");
  return {
    requestId: first?.requestId ?? "",
    at: text(first, "at"),
    atomy: first?.atomy ?? "",
    promptVersion: text(request, "promptVersion"),
    status: count(response, "status"),
    error: text(response, "error"),
    calls: lines.filter(({ event }) => event === "attempt" || event === "step")
      .length,
    sdkRetries: count(response, "sdkRetries"),
    inputTokens: count(response, "inputTokens"),
    outputTokens: count(response, "outputTokens"),
    reasoningTokens: count(response, "reasoningTokens"),
    firstChunkMs: count(response, "firstChunkMs"),
    totalMs: count(response, "totalMs"),
  };
}

function localTime(at: string | undefined): string {
  if (at === undefined) return "-";
  const date = new Date(at);
  return Number.isNaN(date.getTime())
    ? at
    : date.toLocaleTimeString("es-ES", { hour12: false });
}

function cell(value: string | number | undefined): string {
  if (value === undefined) return "-";
  return typeof value === "number" ? String(Math.round(value)) : value;
}

/** A table with one row per request, its columns aligned. */
export function formatSummaryTable(summaries: RequestSummary[]): string {
  const header = [
    "time",
    "id",
    "endpoint",
    "prompt",
    "status",
    "error",
    "calls",
    "retries",
    "in",
    "out",
    "reasoning",
    "first ms",
    "total ms",
  ];
  const rows = summaries.map((s) => [
    localTime(s.at),
    s.requestId.slice(0, 8),
    s.atomy,
    cell(s.promptVersion),
    cell(s.status),
    cell(s.error),
    cell(s.calls),
    cell(s.sdkRetries),
    cell(s.inputTokens),
    cell(s.outputTokens),
    cell(s.reasoningTokens),
    cell(s.firstChunkMs),
    cell(s.totalMs),
  ]);
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => row[column]?.length ?? 0)),
  );
  return [header, ...rows]
    .map((row) =>
      row
        .map((value, column) => value.padEnd(widths[column] ?? 0))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

const IDENTITY_KEYS: ReadonlySet<string> = new Set<LogKey>([
  "at",
  "atomy",
  "requestId",
  "event",
]);
/** Fields long enough to deserve their own block, below the metrics. */
const BLOCK_KEYS: ReadonlySet<string> = new Set<LogKey>([
  "input",
  "text",
  "validationError",
]);

function eventTitle(line: StoredLogLine): string {
  const number = count(line, line.event === "step" ? "step" : "attempt");
  return number === undefined ? line.event : `${line.event} ${String(number)}`;
}

function formatEvent(line: StoredLogLine): string {
  const metrics: string[] = [];
  const blocks: string[] = [];
  for (const [key, value] of Object.entries(line)) {
    if (IDENTITY_KEYS.has(key) || key === "step" || key === "attempt") {
      continue;
    }
    if (value === undefined) continue;
    const isScalar =
      typeof value === "number" ||
      typeof value === "boolean" ||
      (typeof value === "string" && !BLOCK_KEYS.has(key));
    if (isScalar) {
      metrics.push(
        `${key}: ${typeof value === "number" ? String(Math.round(value)) : String(value)}`,
      );
    } else if (!(Array.isArray(value) && value.length === 0)) {
      const body =
        typeof value === "string" ? value : JSON.stringify(value, null, 2);
      blocks.push(`[${key}]\n${body}`);
    }
  }
  return [
    `── ${eventTitle(line)} ${"─".repeat(40)}`,
    ...(metrics.length > 0 ? [metrics.join(" · ")] : []),
    ...blocks,
  ].join("\n");
}

/** Every event of one request, with its input and raw outputs in full. */
export function formatRequestDetail(lines: StoredLogLine[]): string {
  const first = lines[0];
  if (!first) return "";
  const at = text(first, "at");
  return [
    `${first.atomy} ${first.requestId}${at === undefined ? "" : ` · ${new Date(at).toLocaleString("es-ES", { hour12: false })}`}`,
    ...lines.map(formatEvent),
  ].join("\n\n");
}
