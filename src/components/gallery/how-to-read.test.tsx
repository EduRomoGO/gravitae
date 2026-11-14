import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HowToRead } from "@/components/gallery/how-to-read";

describe("HowToRead", () => {
  it("gathers the explanations under «Glosario de las órbitas»", () => {
    render(<HowToRead />);

    expect(
      screen.getByRole("region", { name: "Glosario de las órbitas" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["Unidades", "unidades"],
    ["Condiciones iniciales", "condiciones-iniciales"],
    ["El instante cero", "instante-cero"],
    ["Estabilidad", "estabilidad"],
  ])("explains «%s» in a part a detail can link to (#%s)", (title, id) => {
    render(<HowToRead />);

    expect(screen.getByRole("region", { name: title })).toHaveAttribute(
      "id",
      id,
    );
  });

  it("says that t = 0 is a reference mark on an endless orbit, with the trail behind each body", () => {
    render(<HowToRead />);

    const instantZero = screen.getByRole("region", {
      name: "El instante cero",
    });
    expect(instantZero).toHaveTextContent(
      "los cuerpos nunca están parados: recorren la misma figura una y otra vez, sin principio ni final.",
    );
    expect(instantZero).toHaveTextContent(
      "en t = 0 se ve una estela detrás de cada uno: es el tramo que acaban de recorrer.",
    );
  });

  it("says that no orbit deforms on screen because one lap is repeated", () => {
    render(<HowToRead />);

    expect(
      screen.getByRole("region", { name: "Estabilidad" }),
    ).toHaveTextContent(
      "ninguna de las seis órbitas se deforma en pantalla, sea estable o inestable.",
    );
  });
});
