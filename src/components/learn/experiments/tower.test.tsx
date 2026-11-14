import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tower } from "@/components/learn/experiments/tower";
import { renderAtWidth } from "@tests/support/rendered-width";

describe("Tower", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts on the surface, where 1 kg weighs 9,8 N", () => {
    const { container } = render(<Tower />);

    // The drawing holds the marks' buttons, so it is not an image: its title
    // is read straight from the markup.
    expect(container.querySelector("svg > title")).toHaveTextContent(
      "Ascensor a 1 radios del centro de la Tierra",
    );
    expect(container).toHaveTextContent("Peso de 1 kg: 9,8 ÷ (1 × 1) = 9,8 N");
    expect(container).toHaveTextContent("peso: 9,8 N");
  });

  it("divides the weight by the square of the distance as the lift climbs", async () => {
    const user = userEvent.setup();
    const { container } = render(<Tower />);

    const mark = (n: number) =>
      screen.getByRole("button", {
        name: `Llevar el ascensor a ×${String(n)}`,
      });

    await user.click(mark(2));

    expect(container).toHaveTextContent("Peso de 1 kg: 9,8 ÷ (2 × 2) = 2,45 N");

    await user.click(mark(3));

    expect(container).toHaveTextContent("Peso de 1 kg: 9,8 ÷ (3 × 3) = 1,09 N");
  });

  it("sends the lift up or down to the mark the reader taps", async () => {
    const user = userEvent.setup();
    const { container } = render(<Tower />);
    const mark = (n: number) =>
      screen.getByRole("button", {
        name: `Llevar el ascensor a ×${String(n)}`,
      });

    await user.click(mark(3));

    expect(mark(3)).toHaveAttribute("aria-pressed", "true");
    expect(container).toHaveTextContent("Peso de 1 kg: 9,8 ÷ (3 × 3) = 1,09 N");

    await user.click(mark(1));

    expect(mark(1)).toHaveAttribute("aria-pressed", "true");
    expect(mark(3)).toHaveAttribute("aria-pressed", "false");
    expect(container).toHaveTextContent("Peso de 1 kg: 9,8 ÷ (1 × 1) = 9,8 N");
  });

  it.each([300, 560])("stops at ×3 at %ipx wide", (width) => {
    renderAtWidth(width);
    render(<Tower />);

    expect(
      screen.getByRole("button", { name: "Llevar el ascensor a ×3" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Llevar el ascensor a ×4" }),
    ).not.toBeInTheDocument();
  });
});
