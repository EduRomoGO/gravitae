import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { PlanetRanking } from "@/components/learn/experiments/planet-ranking";
import {
  PLANET_NAMES,
  RIGHT_NAMES,
} from "@/components/learn/experiments/planets";
import { Predict } from "@/components/learn/lesson/predict";
import { ranking } from "@/components/learn/lesson/responses";
import { Step, Steps } from "@/components/learn/lesson/steps";

const PLANETS = ["Saturno", "Tierra", "Urano"];

function Ranking(): ReactElement {
  return (
    <Predict
      id="planeta"
      question="¿Dónde pesaría más 1 kg?"
      response={ranking(PLANET_NAMES, RIGHT_NAMES, <PlanetRanking />)}
      explanation={<p>La masa no basta para ordenarlos.</p>}
    />
  );
}

function planet(name: string): HTMLElement {
  const button = screen
    .getByText(name, { selector: "button > span" })
    .closest("button");
  if (!button) throw new Error(`No button for ${name}`);
  return button;
}

async function rank(names: readonly string[]) {
  const user = userEvent.setup();
  for (const name of names) await user.click(planet(name));
}

describe("PlanetRanking", () => {
  it("shows each planet with its mass only", () => {
    render(<Ranking />);

    expect(planet("Saturno")).toHaveTextContent(
      "95 veces la masa de la Tierra",
    );
    expect(planet("Urano")).toHaveTextContent(
      "14,5 veces la masa de la Tierra",
    );
    expect(planet("Tierra")).toHaveTextContent("5,97 × 1024 kg");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("numbers the planets in the order they are tapped, and untaps them", async () => {
    render(<Ranking />);

    await rank(["Tierra", "Saturno"]);
    expect(planet("Tierra")).toHaveTextContent(/^1/);
    expect(planet("Saturno")).toHaveTextContent(/^2/);

    await rank(["Tierra"]);
    expect(planet("Saturno")).toHaveTextContent(/^1/);
    expect(planet("Tierra")).not.toHaveTextContent(/^\d/);
  });

  it("lets the reader check only once every planet is ranked", async () => {
    render(<Ranking />);

    await rank(PLANETS.slice(0, 2));
    expect(
      screen.queryByRole("button", { name: "Comprobar" }),
    ).not.toBeInTheDocument();

    await rank(PLANETS.slice(2));
    expect(screen.getByRole("button", { name: "Comprobar" })).toBeEnabled();
  });

  it("tells the reader the right order when they missed it, and explains why", async () => {
    render(<Ranking />);
    await rank(["Tierra", "Saturno", "Urano"]);

    await userEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Has elegido «Tierra, Saturno, Urano», pero la respuesta correcta es «Saturno, Tierra, Urano».",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "La masa no basta para ordenarlos.",
    );
  });

  it("tells the reader they got it right", async () => {
    render(<Ranking />);
    await rank(["Saturno", "Tierra", "Urano"]);

    await userEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(screen.getByRole("status")).toHaveTextContent("¡Has acertado!");
  });

  it("reveals the real order with radius and weight next to the reader's", async () => {
    render(<Ranking />);
    await rank(["Tierra", "Saturno", "Urano"]);

    await userEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows.slice(1).map((row) => row.textContent)).toEqual([
      "1.º Saturno×95×9,510,4 N2.º",
      "2.º Tierra5,97 × 1024 kg×1,09,8 N1.º",
      "3.º Urano×14,5×4,08,9 N3.º",
    ]);
    expect(
      screen.getByRole("img", {
        name: "Los tres planetas dibujados a escala",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Comprobar" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the ranking once revealed", async () => {
    render(<Ranking />);
    await rank(PLANETS);
    await userEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    await rank(["Saturno"]);

    expect(planet("Saturno")).toHaveTextContent(/^1/);
  });

  it("tells a screen reader which planets are ranked", async () => {
    render(<Ranking />);

    await rank(["Tierra"]);

    expect(planet("Tierra")).toHaveAttribute("aria-pressed", "true");
    expect(planet("Saturno")).toHaveAttribute("aria-pressed", "false");
  });

  it("disables the planets once checked", async () => {
    render(<Ranking />);
    await rank(PLANETS);
    await userEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    for (const name of PLANETS) expect(planet(name)).toBeDisabled();
  });

  it("shows the next step once checked", async () => {
    render(
      <Steps order={["uno", "dos"]}>
        <Step id="uno">
          <Ranking />
        </Step>
        <Step id="dos">
          <p>Siguiente paso</p>
        </Step>
      </Steps>,
    );
    await rank(PLANETS);

    await userEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(screen.getByText("Siguiente paso")).toBeInTheDocument();
  });
});
