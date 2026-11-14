import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import GravitationLawPage from "@/app/ley-gravitacion-universal-newton/page";
import { SECTION_SELECTOR } from "@/components/learn/lesson/lesson-sections-dom";
import { misconceptionsOf } from "@/lib/lesson/misconceptions";
import { PREDICTION_IDS, PREDICTION_SECTIONS } from "@/lib/lesson/predictions";

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

// Each prediction as a mark of its id, where the page renders it.
vi.mock("@/components/learn/lesson/predict", () => ({
  Predict: ({ id }: { id: string }) => <div data-prediction={id} />,
  usePrediction: () => {
    throw new Error("No answer input renders outside a real <Predict>.");
  },
}));

describe("PREDICTION_SECTIONS", () => {
  it("are the lesson's predictions, in their order, each in its section", async () => {
    const page = await GravitationLawPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({}),
    });

    const { container } = render(page);

    const rendered = [...container.querySelectorAll("[data-prediction]")].map(
      (prediction) => [
        prediction.getAttribute("data-prediction"),
        prediction.closest(SECTION_SELECTOR)?.id,
      ],
    );
    expect(rendered).toEqual(
      PREDICTION_IDS.map((id) => [id, PREDICTION_SECTIONS[id]]),
    );
  });
});

describe("the misconceptions of each prediction", () => {
  it.each(PREDICTION_IDS)("«%s» has at least one", (id) => {
    expect(misconceptionsOf(id).length).toBeGreaterThan(0);
  });

  it("keeps apart the two predictions of «distancia»", () => {
    expect(misconceptionsOf("distancia")).toEqual([
      "distancia-sin-cuadrado",
      "distancia-no-importa",
    ]);
    expect(misconceptionsOf("esfera")).toEqual([
      "atraccion-se-gasta",
      "atraccion-segun-tamano-aparente",
    ]);
  });
});
