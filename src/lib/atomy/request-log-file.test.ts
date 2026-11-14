import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fileLogSink } from "@/lib/atomy/request-log-file";

describe("the log file sink", () => {
  let dir = "";
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("appends each line with its time to the file of its local day", () => {
    dir = join(mkdtempSync(join(tmpdir(), "atomy-log-")), "nested");
    const times = [
      new Date(2026, 10, 12, 23, 59, 0),
      new Date(2026, 10, 12, 23, 59, 30),
      new Date(2026, 10, 13, 0, 0, 5),
    ];
    let call = 0;
    const sink = fileLogSink(dir, () => times[call++] ?? new Date());

    const reducedMode = {
      atomy: "chat",
      event: "response",
      outcome: "rejected",
      status: 503,
      error: "reduced-mode",
    } as const;
    sink({ ...reducedMode, requestId: "a" });
    sink({ ...reducedMode, requestId: "b" });
    sink({ ...reducedMode, requestId: "c" });

    expect(readdirSync(dir).sort()).toEqual([
      "2026-11-12.jsonl",
      "2026-11-13.jsonl",
    ]);
    const firstDay = readFileSync(join(dir, "2026-11-12.jsonl"), "utf8")
      .trimEnd()
      .split("\n")
      .map((line): unknown => JSON.parse(line));
    expect(firstDay).toEqual([
      { at: times[0]?.toISOString(), ...reducedMode, requestId: "a" },
      { at: times[1]?.toISOString(), ...reducedMode, requestId: "b" },
    ]);
  });
});
