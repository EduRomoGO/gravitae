import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import GravitationLawPage from "@/app/ley-gravitacion-universal-newton/page";
import { SECTION_SELECTOR } from "@/components/learn/lesson/lesson-sections-dom";
import { SECTION_IDS } from "@/lib/lesson/sections";

// A reader who has already met Atomy: the lesson, without its presentation.
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => ({ value: "seen" }) }),
}));

// Every step at once: the lesson shows its sections one step at a time.
vi.mock("@/components/learn/lesson/steps", () => ({
  Steps: ({ children }: { children: ReactNode }) => children,
  Step: ({ children }: { children: ReactNode }) => children,
  Revealed: ({ children }: { children: ReactNode }) => children,
  useResolveStep: () => () => undefined,
  useShowAll: () => false,
}));

describe("SECTION_IDS", () => {
  it("are the ids of the lesson's sections, in their order", async () => {
    const page = await GravitationLawPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({}),
    });

    const { container } = render(page);

    const ids = [...container.querySelectorAll(SECTION_SELECTOR)].map(
      (section) => section.id,
    );
    expect(ids).toEqual(SECTION_IDS);
  });
});
