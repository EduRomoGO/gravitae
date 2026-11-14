import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ASTRO_NAMES,
  Choice,
  SpringGauge,
  Stepper,
  useBounce,
  useClock,
} from "@/components/learn/experiments/controls";
import { SURFACE_G } from "@/lib/gravitation/figures";
import {
  advanceFrames,
  installFakeAnimationFrames,
} from "@tests/support/animation-frames";
import { preferReducedMotion } from "@tests/support/reduced-motion";

function ControlledStepper(): ReactElement {
  const [value, setValue] = useState(1);
  return (
    <Stepper
      label="Distancia"
      value={value}
      min={1}
      max={3}
      onChange={setValue}
    />
  );
}

describe("Stepper", () => {
  it("shows its value as ×n by default", () => {
    render(<ControlledStepper />);

    expect(screen.getByText("×1")).toBeInTheDocument();
  });

  it("steps up and down between its bounds", async () => {
    const user = userEvent.setup();
    render(<ControlledStepper />);
    const less = screen.getByRole("button", { name: "Menos: Distancia" });
    const more = screen.getByRole("button", { name: "Más: Distancia" });

    expect(less).toBeDisabled();
    await user.click(more);
    await user.click(more);

    expect(screen.getByText("×3")).toBeInTheDocument();
    expect(more).toBeDisabled();
    await user.click(less);
    expect(screen.getByText("×2")).toBeInTheDocument();
    expect(less).toBeEnabled();
  });

  it("shows its value with the given format", () => {
    render(
      <Stepper
        label="Masa"
        value={2}
        min={1}
        max={5}
        onChange={vi.fn()}
        format={(value) => `${String(value)} kg`}
      />,
    );

    expect(screen.getByText("2 kg")).toBeInTheDocument();
  });
});

describe("Choice", () => {
  it("marks the chosen option as pressed and reports a new one", async () => {
    const onChange = vi.fn();
    render(
      <Choice options={["A", "B"] as const} value="A" onChange={onChange} />,
    );

    expect(screen.getByRole("button", { name: "A" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "B" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await userEvent.click(screen.getByRole("button", { name: "B" }));

    expect(onChange).toHaveBeenCalledWith("B");
  });
});

describe("SpringGauge", () => {
  it("labels the box with each of its lines and the ruler in newtons", () => {
    const { container } = render(
      <svg>
        <SpringGauge
          x={100}
          top={40}
          weight={5}
          pxPerN={10}
          maxN={10}
          tickN={1}
          label={["masa: 1 kg", "peso: 5,00 N"]}
        />
      </svg>,
    );

    expect(container).toHaveTextContent("masa: 1 kg");
    expect(container).toHaveTextContent("peso: 5,00 N");
    expect(container).toHaveTextContent("0 N");
    expect(container).toHaveTextContent("10 N");
  });
});

describe("animation hooks", () => {
  beforeEach(() => {
    installFakeAnimationFrames();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("useBounce starts at the target and settles on a new one", () => {
    const { result, rerender } = renderHook(({ target }) => useBounce(target), {
      initialProps: { target: 1 },
    });
    expect(result.current).toBe(1);

    rerender({ target: 4 });
    advanceFrames(100);
    expect(result.current).not.toBe(4);

    advanceFrames(5000);
    expect(result.current).toBe(4);
  });

  it("useBounce goes straight to a new target with reduced motion", () => {
    preferReducedMotion();
    const { result, rerender } = renderHook(({ target }) => useBounce(target), {
      initialProps: { target: 1 },
    });

    rerender({ target: 4 });
    advanceFrames(20);

    expect(result.current).toBe(4);
  });

  it("useClock runs while running and stops at its end", () => {
    const onEnd = vi.fn();
    const { result, rerender } = renderHook(
      ({ running }) => useClock(running, 2, onEnd),
      { initialProps: { running: false } },
    );
    expect(result.current[0]).toBe(0);

    rerender({ running: true });
    advanceFrames(1000);
    expect(result.current[0]).toBeCloseTo(1, 1);
    expect(onEnd).not.toHaveBeenCalled();

    advanceFrames(2000);
    expect(result.current[0]).toBe(2);
    expect(onEnd).toHaveBeenCalledOnce();
  });
});

describe("astros", () => {
  it("lists the four astros from the weakest gravity to the strongest", () => {
    expect(ASTRO_NAMES).toEqual(["Luna", "Marte", "Tierra", "Júpiter"]);
    const gravities = ASTRO_NAMES.map((name) => SURFACE_G[name]);
    expect(gravities).toEqual([...gravities].sort((a, b) => a - b));
  });
});
