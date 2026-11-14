import { afterEach, describe, expect, it, vi } from "vitest";
import { probeGemini } from "@/lib/atomy/gemini";
import { ATOMY_MODEL_ID } from "@/lib/atomy/model";
import {
  AVAILABLE_TTL_MS,
  createModelStatusCache,
  statusOfProbe,
  type ModelStatus,
} from "@/lib/atomy/model-status";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("statusOfProbe", () => {
  it.each([
    [null, "unreachable"],
    [{ status: 200 }, "available"],
    [{ status: 429 }, "available"],
    [{ status: 500 }, "unreachable"],
    [{ status: 503 }, "unreachable"],
  ] as const)("reads %j as %s", (response, status) => {
    expect(statusOfProbe(response)).toBe(status);
  });
});

describe("probeGemini", () => {
  it("is no-key without the key, and asks nothing", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    const fetchImpl = vi.fn<typeof fetch>();

    expect(await probeGemini(fetchImpl)).toBe("no-key");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks the model's own resource with the key", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "clave");
    vi.stubEnv("ATOMY_GEMINI_BASE_URL", "http://gemini.test/v1beta");
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({}, { status: 200 })),
    );

    expect(await probeGemini(fetchImpl)).toBe("available");
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`http://gemini.test/v1beta/models/${ATOMY_MODEL_ID}`);
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("clave");
  });

  it("asks the Gemini API when the base URL is empty, as the chat does", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "clave");
    vi.stubEnv("ATOMY_GEMINI_BASE_URL", "");
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({}, { status: 200 })),
    );

    expect(await probeGemini(fetchImpl)).toBe("available");
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${ATOMY_MODEL_ID}`,
    );
  });

  it("is unreachable when the request fails", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "clave");
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.reject(new TypeError("fetch failed")),
    );

    expect(await probeGemini(fetchImpl)).toBe("unreachable");
  });
});

describe("createModelStatusCache", () => {
  function setup(statuses: ModelStatus[]) {
    let time = 0;
    const probe = vi.fn(() =>
      Promise.resolve<ModelStatus>(statuses.shift() ?? "available"),
    );
    const status = createModelStatusCache(probe, () => time);
    return {
      probe,
      status,
      advance: (ms: number) => {
        time += ms;
      },
    };
  }

  it("keeps an available answer for a while", async () => {
    const { probe, status, advance } = setup(["available", "unreachable"]);

    expect(await status()).toBe("available");
    advance(AVAILABLE_TTL_MS - 1);
    expect(await status()).toBe("available");
    expect(probe).toHaveBeenCalledTimes(1);
    advance(1);
    expect(await status()).toBe("unreachable");
  });

  it("asks again after an unavailable answer", async () => {
    const { probe, status } = setup(["unreachable", "available"]);

    expect(await status()).toBe("unreachable");
    expect(await status()).toBe("available");
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it("asks again when the answer must be fresh", async () => {
    const { status } = setup(["available", "unreachable"]);

    await status();

    expect(await status({ fresh: true })).toBe("unreachable");
  });
});
