// Shows the development log of the requests to the model (Atomy's chat and
// correction), kept in logs/atomy/<YYYY-MM-DD>.jsonl by `next dev`.
//
// Usage: npm run atomy-logs -- [options]
//   (no options)        one row per request of the latest day logged
//   --date YYYY-MM-DD   the requests of that day
//   --all               the requests of every day
//   --errors            only the requests whose response carries an error
//   --endpoint NAME     only `chat`, only `finder-chat` or only `correction`
//   --last N            only the last N requests
//   --id PREFIX         every event of the request whose id starts with
//                       PREFIX (searched in every day): its input, each
//                       attempt or step with its raw output, and the response
//   --dir DIR           read the log from DIR instead of logs/atomy

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  formatRequestDetail,
  formatSummaryTable,
  groupByRequest,
  parseLogLines,
  summarizeRequest,
} from "../src/lib/atomy/request-log-view.ts";

const { values } = parseArgs({
  options: {
    date: { type: "string" },
    all: { type: "boolean", default: false },
    errors: { type: "boolean", default: false },
    endpoint: { type: "string" },
    last: { type: "string" },
    id: { type: "string" },
    dir: { type: "string", default: join("logs", "atomy") },
  },
});

const dir = values.dir;
const days = existsSync(dir)
  ? readdirSync(dir)
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
      .sort()
  : [];
if (days.length === 0) {
  console.error(
    `No log in ${dir}. It is written by \`npm run dev\` on every request to /api/atomy/*.`,
  );
  process.exit(1);
}

function linesOf(files: string[]) {
  return files.flatMap((file) =>
    parseLogLines(readFileSync(join(dir, file), "utf8")),
  );
}

if (values.id !== undefined) {
  const prefix = values.id;
  const matches = [...groupByRequest(linesOf(days))].filter(([requestId]) =>
    requestId.startsWith(prefix),
  );
  if (matches.length !== 1) {
    console.error(
      matches.length === 0
        ? `No request whose id starts with ${prefix}.`
        : `${String(matches.length)} requests start with ${prefix}: ${matches.map(([id]) => id).join(", ")}`,
    );
    process.exit(1);
  }
  console.log(formatRequestDetail(matches[0]?.[1] ?? []));
  process.exit(0);
}

let files: string[];
if (values.all) {
  files = days;
} else if (values.date !== undefined) {
  files = days.filter((name) => name === `${values.date ?? ""}.jsonl`);
  if (files.length === 0) {
    console.error(
      `No log for ${values.date}. Days logged: ${days.map((d) => d.replace(".jsonl", "")).join(", ")}`,
    );
    process.exit(1);
  }
} else {
  files = days.slice(-1);
}

let summaries = [...groupByRequest(linesOf(files)).values()].map(
  summarizeRequest,
);
if (values.errors) {
  summaries = summaries.filter(({ error }) => error !== undefined);
}
if (values.endpoint !== undefined) {
  summaries = summaries.filter(({ atomy }) => atomy === values.endpoint);
}
if (values.last !== undefined) {
  summaries = summaries.slice(-Number(values.last));
}

console.log(`${files.map((f) => join(dir, f)).join(", ")}\n`);
console.log(formatSummaryTable(summaries));
console.log(
  `\n${String(summaries.length)} requests. Detail: npm run atomy-logs -- --id <id>`,
);
