import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GrowingSphere } from "@/components/learn/experiments/growing-sphere";

const farther = () =>
  screen.getByRole("button", { name: "Más: Distancia de B al centro" });
const closer = () =>
  screen.getByRole("button", { name: "Menos: Distancia de B al centro" });

describe("GrowingSphere", () => {
  it("starts with B on the surface, covering the whole patch", () => {
    const { container } = render(<GrowingSphere />);

    expect(
      screen.getByRole("img", {
        name: "Vista lateral: B a distancia ×1 del centro del planeta, sobre la esfera que crece desde ese centro",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "El trozo de esfera de frente: 1 hueco del tamaño de B, uno ocupado por B",
      }),
    ).toBeInTheDocument();
    expect(container).toHaveTextContent(
      "A ×1 B lo tapa entero: le llega todo y 1 kg pesa 9,8 N.",
    );
    expect(closer()).toBeDisabled();
  });

  it("spreads the patch over d × d holes and gives B 1/d² as it moves away", async () => {
    const user = userEvent.setup();
    const { container } = render(<GrowingSphere />);

    await user.click(farther());

    expect(
      screen.getByRole("img", {
        name: "Vista lateral: B a distancia ×2 del centro del planeta, sobre la esfera que crece desde ese centro",
      }),
    ).toBeInTheDocument();
    const front = screen.getByRole("img", {
      name: "El trozo de esfera de frente: 4 huecos del tamaño de B, uno ocupado por B",
    });
    expect(front.querySelectorAll("rect")).toHaveLength(4);
    expect(container).toHaveTextContent(
      "A ×2 es 2 veces más ancho y 2 veces más alto: caben 4 B. A B le llega 1/4 y 1 kg pesa 2,45 N.",
    );

    await user.click(farther());

    expect(container).toHaveTextContent(
      "caben 9 B. A B le llega 1/9 y 1 kg pesa 1,09 N.",
    );

    await user.click(farther());

    expect(container).toHaveTextContent(
      "caben 16 B. A B le llega 1/16 y 1 kg pesa 0,61 N.",
    );
    expect(farther()).toBeDisabled();
  });
});
