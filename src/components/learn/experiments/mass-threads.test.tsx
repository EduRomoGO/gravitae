import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MassThreads } from "@/components/learn/experiments/mass-threads";

function threads(container: HTMLElement): number {
  return container.querySelectorAll("line").length;
}

describe("MassThreads", () => {
  it("joins 2 beads of A and 3 of B with 6 threads", () => {
    const { container } = render(<MassThreads />);

    expect(threads(container)).toBe(6);
    expect(container).toHaveTextContent(
      "2 bolitas de A × 3 bolitas de B = 6 hilos.",
    );
    expect(container).toHaveTextContent("tira lo mismo que al principio.");
    expect(container).toHaveTextContent("Fuerza: 6 × 1 = ×6");
  });

  it("adds a thread per bead of the other mass", async () => {
    const user = userEvent.setup();
    const { container } = render(<MassThreads />);

    await user.click(screen.getByRole("button", { name: "Más: Bolitas de A" }));

    expect(threads(container)).toBe(9);
    expect(container).toHaveTextContent("Fuerza: 9 × 1 = ×9");

    await user.click(
      screen.getByRole("button", { name: "Menos: Bolitas de B" }),
    );
    expect(threads(container)).toBe(6);
  });

  it("thins every thread to 1/d² as B moves away", async () => {
    const user = userEvent.setup();
    const { container } = render(<MassThreads />);

    await user.click(screen.getByRole("button", { name: "Más: Distancia" }));

    expect(container).toHaveTextContent("tira 1/(2 × 2) = 1/4.");
    expect(container).toHaveTextContent("Fuerza: 6 × 1/4 = ×3/2");

    await user.click(screen.getByRole("button", { name: "Más: Distancia" }));

    expect(container).toHaveTextContent("Fuerza: 6 × 1/9 = ×2/3");
    expect(
      screen.getByRole("button", { name: "Más: Distancia" }),
    ).toBeDisabled();
  });
});
