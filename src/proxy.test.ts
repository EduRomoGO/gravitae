import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ATOMY_NO_KEY_COOKIE } from "@/components/atomy/atomy-cookie";
import { config, proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

function page(cookie?: string): NextRequest {
  return new NextRequest("http://localhost/galeria", {
    headers: cookie === undefined ? {} : { cookie },
  });
}

describe("the proxy", () => {
  it("tells the page that the server has no key", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");

    const cookie = proxy(page()).cookies.get(ATOMY_NO_KEY_COOKIE);

    expect(cookie).toMatchObject({ value: "1", path: "/", sameSite: "lax" });
  });

  it("does not set the cookie again while the page already has it", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");

    const response = proxy(page(`${ATOMY_NO_KEY_COOKIE}=1`));

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("removes the cookie once the server has the key", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "una-clave");

    const response = proxy(page(`${ATOMY_NO_KEY_COOKIE}=1`));

    expect(response.headers.get("set-cookie")).toMatch(
      new RegExp(`^${ATOMY_NO_KEY_COOKIE}=;.*Expires=Thu, 01 Jan 1970`),
    );
  });

  it("leaves the page alone with the key", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "una-clave");

    expect(proxy(page()).headers.get("set-cookie")).toBeNull();
  });

  it("runs on the pages only", () => {
    const runsOn = (path: string): boolean =>
      config.matcher.some((matcher) => new RegExp(`^${matcher}$`).test(path));

    expect(runsOn("/")).toBe(true);
    expect(runsOn("/galeria/figura-de-ocho")).toBe(true);
    expect(runsOn("/api/atomy/status")).toBe(false);
    expect(runsOn("/_next/static/chunks/main.js")).toBe(false);
    expect(runsOn("/favicon.ico")).toBe(false);
  });
});
