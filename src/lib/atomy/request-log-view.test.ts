import { describe, expect, it } from "vitest";
import {
  formatRequestDetail,
  formatSummaryTable,
  groupByRequest,
  parseLogLines,
  summarizeRequest,
} from "@/lib/atomy/request-log-view";

const LOG = [
  {
    at: "2026-11-12T18:22:01.000Z",
    atomy: "correction",
    requestId: "11111111-aaaa",
    event: "request",
    model: "gemini-3.5-flash",
    promptVersion: "correction-v2",
    input: "<seccion>Tres cajas</seccion>",
  },
  {
    at: "2026-11-12T18:22:02.000Z",
    atomy: "chat",
    requestId: "22222222-bbbb",
    event: "response",
    status: 400,
    error: "invalid-request",
    rejection: { reason: "invalid-json" },
  },
  {
    at: "2026-11-12T18:22:03.000Z",
    atomy: "correction",
    requestId: "11111111-aaaa",
    event: "attempt",
    attempt: 1,
    outcome: "invalid-output",
    finishReason: "stop",
    inputTokens: 1200,
    outputTokens: 80,
    reasoningTokens: 40,
    totalMs: 1530.4,
    sdkRetries: 0,
    text: '{"verdict":',
    validationError: "Unexpected end of JSON",
  },
  {
    at: "2026-11-12T18:22:04.000Z",
    atomy: "correction",
    requestId: "11111111-aaaa",
    event: "attempt",
    attempt: 2,
    outcome: "success",
    totalMs: 900,
    sdkRetries: 1,
    text: '{"verdict":"ok"}',
  },
  {
    at: "2026-11-12T18:22:04.100Z",
    atomy: "correction",
    requestId: "11111111-aaaa",
    event: "response",
    status: 200,
    attempts: 2,
    sdkRetries: 1,
    inputTokens: 2400,
    outputTokens: 120,
    reasoningTokens: 60,
    totalMs: 2431.7,
  },
]
  .map((line) => JSON.stringify(line))
  .join("\n");

describe("the log viewer", () => {
  it("parses the log lines, skipping blank, broken and foreign lines", () => {
    const lines = parseLogLines(
      `${LOG}\n\nnot json\n{"timestamp":"00:00:01","message":"x"}\n`,
    );

    expect(lines).toHaveLength(5);
  });

  it("summarizes each request from its request, calls and response", () => {
    const groups = groupByRequest(parseLogLines(LOG));
    const summaries = [...groups.values()].map(summarizeRequest);

    expect(summaries).toEqual([
      {
        requestId: "11111111-aaaa",
        at: "2026-11-12T18:22:01.000Z",
        atomy: "correction",
        promptVersion: "correction-v2",
        status: 200,
        error: undefined,
        calls: 2,
        sdkRetries: 1,
        inputTokens: 2400,
        outputTokens: 120,
        reasoningTokens: 60,
        firstChunkMs: undefined,
        totalMs: 2431.7,
      },
      {
        requestId: "22222222-bbbb",
        at: "2026-11-12T18:22:02.000Z",
        atomy: "chat",
        promptVersion: undefined,
        status: 400,
        error: "invalid-request",
        calls: 0,
        sdkRetries: undefined,
        inputTokens: undefined,
        outputTokens: undefined,
        reasoningTokens: undefined,
        firstChunkMs: undefined,
        totalMs: undefined,
      },
    ]);
  });

  it("renders one aligned row per request, with a dash for what is missing", () => {
    const summaries = [...groupByRequest(parseLogLines(LOG)).values()].map(
      summarizeRequest,
    );

    const rows = formatSummaryTable(summaries).split("\n");

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^time\s+id\s+endpoint\s+prompt\s+status\s+error/);
    expect(rows[1]).toMatch(
      /11111111\s+correction\s+correction-v2\s+200\s+-\s+2\s+1\s+2400\s+120\s+60\s+-\s+2432$/,
    );
    expect(rows[2]).toMatch(/22222222\s+chat\s+-\s+400\s+invalid-request/);
    expect(rows[1]?.indexOf("correction-v2")).toBe(rows[2]?.indexOf("- "));
  });

  it("renders every event of a request with its metrics, input and raw output", () => {
    const lines = groupByRequest(parseLogLines(LOG)).get("11111111-aaaa") ?? [];

    const detail = formatRequestDetail(lines);

    expect(detail).toContain("correction 11111111-aaaa");
    expect(detail).toContain("── request");
    expect(detail).toContain("[input]\n<seccion>Tres cajas</seccion>");
    expect(detail).toContain(
      "outcome: invalid-output · finishReason: stop · inputTokens: 1200 · outputTokens: 80 · reasoningTokens: 40 · totalMs: 1530 · sdkRetries: 0",
    );
    expect(detail).toContain('[text]\n{"verdict":');
    expect(detail).toContain("[validationError]\nUnexpected end of JSON");
    expect(detail).toContain("── attempt 2");
    expect(detail).toContain("── response");
    expect(detail).not.toContain("requestId:");
  });

  it("renders nested fields of an event as indented JSON", () => {
    const lines = groupByRequest(parseLogLines(LOG)).get("22222222-bbbb") ?? [];

    expect(formatRequestDetail(lines)).toContain(
      '[rejection]\n{\n  "reason": "invalid-json"\n}',
    );
  });
});
