import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SOLUTION_SLUGS } from "@/lib/orbits/solutions";
import SolutionDetailPage, { generateMetadata } from "./page";

// The player animates the orbit; e2e/playback-controls.spec.ts covers it in the browser.
vi.mock("@/components/gallery/orbit-player", () => ({
  OrbitPlayer: () => null,
}));

const STABLE = "Estable, según la literatura. Qué significa estable";
const UNSTABLE = "Inestable, según la literatura. Qué significa inestable";
const COLLINEAR =
  "Uno de los momentos en que los tres cuerpos quedan en línea, con uno en el centro.";
const FOUND_BY_COMPUTER =
  "Encontrada mediante búsqueda numérica por Šuvakov y Dmitrašinović en 2013.";
const LI_LIAO = /^Fuente: Xiaoming Li y Shijun Liao \(2017\)/;
const SUVAKOV = /^En 2013, Milovan Šuvakov y Veljko Dmitrašinović, /;

const DETAILS = [
  {
    slug: "lagrange",
    instantZero: "Una posición cualquiera del triángulo mientras gira.",
    title: "Lagrange",
    description:
      "Los tres cuerpos forman un triángulo equilátero que gira sin deformarse.",
    lap: "8,27 unidades de tiempo",
    stability: UNSTABLE,
    source: "Fuente: Cálculo propio a partir de la geometría del triángulo.",
    discovery: /^En 1772, Lagrange demostró /,
  },
  {
    slug: "figura-de-ocho",
    instantZero:
      "Uno de los momentos en que un cuerpo pasa por el cruce del 8 y los otros dos quedan a los lados.",
    title: "Figura de ocho",
    description:
      "Los tres cuerpos recorren, uno tras otro, una misma curva con forma de 8.",
    lap: "6,33 unidades de tiempo",
    stability: STABLE,
    source: LI_LIAO,
    discovery: /^En 1993, Cristopher Moore encontró /,
  },
  {
    slug: "butterfly-i",
    instantZero: COLLINEAR,
    title: "Butterfly I",
    description: FOUND_BY_COMPUTER,
    lap: "6,23 unidades de tiempo",
    stability: UNSTABLE,
    source: LI_LIAO,
    discovery: SUVAKOV,
  },
  {
    slug: "goggles",
    instantZero: COLLINEAR,
    title: "Goggles",
    description: FOUND_BY_COMPUTER,
    lap: "10,46 unidades de tiempo",
    stability: UNSTABLE,
    source: LI_LIAO,
    discovery: SUVAKOV,
  },
  {
    slug: "moth-i",
    instantZero: COLLINEAR,
    title: "Moth I",
    description: FOUND_BY_COMPUTER,
    lap: "14,89 unidades de tiempo",
    stability: STABLE,
    source: LI_LIAO,
    discovery: SUVAKOV,
  },
  {
    slug: "yin-yang-i",
    instantZero: COLLINEAR,
    title: "Yin-Yang I",
    description: FOUND_BY_COMPUTER,
    lap: "10,96 unidades de tiempo",
    stability: UNSTABLE,
    source: LI_LIAO,
    discovery: SUVAKOV,
  },
];

function factAfter(term: string): HTMLElement | null {
  const next = screen.getByText(term, { selector: "dt" }).nextElementSibling;
  return next instanceof HTMLElement ? next : null;
}

describe("SolutionDetailPage", () => {
  it.each(DETAILS)(
    "/galeria/$slug shows its title, description, lap duration, instant 0, stability, initial conditions and discovery",
    async ({
      slug,
      title,
      description,
      lap,
      instantZero,
      stability,
      source,
      discovery,
    }) => {
      render(
        await SolutionDetailPage({
          params: Promise.resolve({ slug }),
          searchParams: Promise.resolve({}),
        }),
      );

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        title,
      );
      expect(screen.getByText(description)).toBeInTheDocument();
      expect(factAfter("Una vuelta")).toHaveTextContent(lap);
      expect(factAfter("Instante 0")).toHaveTextContent(instantZero);
      expect(factAfter("Estabilidad")).toHaveTextContent(stability);

      const conditions = screen.getByRole("region", {
        name: /^Condiciones iniciales/,
      });
      expect(within(conditions).getAllByRole("row")).toHaveLength(4);
      expect(within(conditions).getByText(/^Fuente:/)).toHaveTextContent(
        source,
      );
      expect(within(conditions).getByText(discovery)).toBeInTheDocument();
    },
  );

  it("links each common explanation to its part of the gallery", async () => {
    render(
      await SolutionDetailPage({
        params: Promise.resolve({ slug: "goggles" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByRole("link", { name: "Qué es la unidad de tiempo" }),
    ).toHaveAttribute("href", "/galeria#unidades");
    expect(
      screen.getByRole("link", { name: "Qué es el instante 0" }),
    ).toHaveAttribute("href", "/galeria#instante-cero");
    expect(
      screen.getByRole("link", { name: "Qué significa inestable" }),
    ).toHaveAttribute("href", "/galeria#estabilidad");
    expect(
      screen.getByRole("link", { name: "Qué son las condiciones iniciales" }),
    ).toHaveAttribute("href", "/galeria#condiciones-iniciales");
  });
});

describe("generateMetadata", () => {
  it("gives each solution a meta description of its own, the shape of its orbit", async () => {
    const descriptions = await Promise.all(
      SOLUTION_SLUGS.map(async (slug) => {
        const { description } = await generateMetadata({
          params: Promise.resolve({ slug }),
          searchParams: Promise.resolve({}),
        });
        return description;
      }),
    );

    expect(descriptions[1]).toBe(
      "Los tres cuerpos recorren, uno tras otro, una misma curva con forma de 8.",
    );
    expect(descriptions[3]).toMatch(/^Una figura inclinada en diagonal/);
    expect(new Set(descriptions).size).toBe(SOLUTION_SLUGS.length);
  });
});
