import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpringGauge } from "@/components/learn/experiments/controls";
import { SpringScale } from "@/components/learn/experiments/spring-scale";
import { renderAtWidth } from "@tests/support/rendered-width";

// The drawing holds the planets' buttons, so it is not an image: its title
// is read straight from the markup.
function title(container: HTMLElement): string | null | undefined {
  return container.querySelector("svg > title")?.textContent;
}

function planet(name: string): HTMLElement {
  return screen.getByRole("button", {
    name: new RegExp(`^Llevar el dinamómetro a ${name}, g = `),
  });
}

describe("SpringScale", () => {
  it("starts on the Earth with 1 kg weighing 9,8 N", () => {
    const { container } = render(<SpringScale />);

    expect(title(container)).toBe("Dinamómetro colgado sobre Tierra");
    expect(planet("Tierra")).toHaveAttribute("aria-pressed", "true");
    expect(container).toHaveTextContent("masa: 1 kg");
    expect(container).toHaveTextContent("peso: 9,8 N");
    expect(container).toHaveTextContent("g = 9,80 m/s²");
  });

  it("carries the scale to the planet the reader taps", async () => {
    const { container } = render(<SpringScale />);

    await userEvent.click(planet("Luna"));

    expect(title(container)).toBe("Dinamómetro colgado sobre Luna");
    expect(planet("Luna")).toHaveAttribute("aria-pressed", "true");
    expect(planet("Tierra")).toHaveAttribute("aria-pressed", "false");
    expect(container).toHaveTextContent("masa: 1 kg");
    expect(container).toHaveTextContent("peso: 1,6 N");
  });

  it.each(["Enter", " "])("carries the scale with the %j key", (key) => {
    const { container } = render(<SpringScale />);

    fireEvent.keyDown(planet("Júpiter"), { key });

    expect(planet("Júpiter")).toHaveAttribute("aria-pressed", "true");
    expect(container).toHaveTextContent("peso: 24,8 N");
  });

  it("travels between the Moon, the Earth and Jupiter only", () => {
    render(<SpringScale />);

    expect(
      screen.getAllByRole("button", { name: /^Llevar el dinamómetro a / }),
    ).toHaveLength(3);
    expect(
      screen.queryByRole("button", { name: /^Llevar el dinamómetro a Marte/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the object at 1 kg, with no control for its mass", () => {
    render(<SpringScale />);

    expect(
      screen.queryByRole("button", { name: /Masa del objeto/ }),
    ).not.toBeInTheDocument();
  });

  it("reads up to 30 N, a number every 5 N, so Jupiter's weight fills the ruler", () => {
    const { container } = render(<SpringScale />);

    const numbers = [...container.querySelectorAll("svg text")]
      .map((text) => text.textContent)
      .filter((text) => /^\d+ N$/.test(text));
    expect(numbers).toEqual([
      "0 N",
      "5 N",
      "10 N",
      "15 N",
      "20 N",
      "25 N",
      "30 N",
    ]);
  });

  it("draws the same instrument as SpringGauge, the lift's spring scale", () => {
    const { container } = render(<SpringScale />);
    const { container: gauge } = render(
      <svg>
        <SpringGauge
          x={100}
          top={40}
          weight={5}
          pxPerN={8}
          maxN={30}
          tickN={1}
          label={["masa: 1 kg", "peso: 5 N"]}
        />
      </svg>,
    );

    expect(coilsOf(container)).toBe(coilsOf(gauge));
  });
});

/** How many zigzag segments the spring of the drawing has. */
function coilsOf(container: HTMLElement): number {
  const spring = container.querySelector("path[fill='none']");
  return spring?.getAttribute("d")?.split("L").length ?? 0;
}

describe("SpringScale on a phone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("drops the names of the labels and keeps value and unit", () => {
    renderAtWidth(300);
    const { container } = render(<SpringScale />);

    expect(container).toHaveTextContent("1 kg");
    expect(container).toHaveTextContent("9,8 N");
    expect(container).toHaveTextContent("9,80 m/s²");
    expect(container).not.toHaveTextContent("masa:");
    expect(container).not.toHaveTextContent("peso:");
    expect(container).not.toHaveTextContent("g = 9,80");
  });

  it("gives the handle a touch area at least 24 px tall, inside the drawing", () => {
    // 600 units drawn 300 px wide: two units a pixel.
    renderAtWidth(300);
    const { container } = render(<SpringScale />);

    const area = container.querySelector('[data-part="handle-touch"]');
    expect(Number(area?.getAttribute("height"))).toBeGreaterThanOrEqual(48);
    expect(Number(area?.getAttribute("width"))).toBeGreaterThanOrEqual(48);
    expect(Number(area?.getAttribute("y"))).toBeGreaterThanOrEqual(0);
  });
});
