import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Astronauts } from "@/components/learn/experiments/astronauts";
import {
  advanceFrameByFrame,
  advanceFrames,
  installFakeAnimationFrames,
} from "@tests/support/animation-frames";
import { withCommitCount } from "@tests/support/commit-count";

beforeEach(() => {
  installFakeAnimationFrames();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Astronauts", () => {
  it("starts with both astronauts still, 1 m apart", () => {
    const { container } = render(<Astronauts />);

    expect(container).toHaveTextContent("Tiempo: 0 h 00 min 00 s");
    expect(container).toHaveTextContent("Se han acercado: 0,000 mm");
    expect(container).toHaveTextContent(
      "Fuerza entre ellos: 0,000000327 N, más o menos lo que pesa una pestaña",
    );
    expect(screen.getByRole("button", { name: "×1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("tiempo real")).toBeInTheDocument();
  });

  it("runs time at the chosen speed and pauses", () => {
    const { container } = render(<Astronauts />);
    fireEvent.click(screen.getByRole("button", { name: "×60" }));
    expect(screen.getByText("cada segundo, un minuto")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    advanceFrames(1000);
    fireEvent.click(screen.getByRole("button", { name: "Pausa" }));

    // One real second, rounded to whole frames, runs about one minute.
    expect(container).toHaveTextContent(
      /Tiempo: 0 h (00 min 5\d|01 min 0\d) s/,
    );
    const paused = container.textContent;
    advanceFrames(1000);
    expect(container.textContent).toBe(paused);
  });

  it("brings them together after almost three hours", () => {
    const { container } = render(<Astronauts />);
    fireEvent.click(screen.getByRole("button", { name: "×3.600" }));
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));

    advanceFrames(5000);

    expect(container).toHaveTextContent(
      /Se tocan al cabo de 2 h \d\d min \d\d s/,
    );
    expect(screen.getByRole("button", { name: "Empezar" })).toBeDisabled();
  });

  it("separates them again", () => {
    const { container } = render(<Astronauts />);
    fireEvent.click(screen.getByRole("button", { name: "×3.600" }));
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    advanceFrames(5000);

    fireEvent.click(
      screen.getByRole("button", { name: "Volver a separarlos" }),
    );

    expect(container).toHaveTextContent("Tiempo: 0 h 00 min 00 s");
    expect(screen.getByRole("button", { name: "Empezar" })).toBeEnabled();
    expect(container).not.toHaveTextContent("Se tocan");
  });

  it("moves them frame by frame without re-rendering until they touch", () => {
    const counted = withCommitCount(<Astronauts />);
    const { container } = render(counted.ui);
    fireEvent.click(screen.getByRole("button", { name: "×600" }));
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    counted.reset();

    advanceFrameByFrame(1000);

    expect(counted.commits()).toBe(0);
    expect(container).toHaveTextContent(
      /Tiempo: 0 h (09 min 5\d|10 min 0\d) s/,
    );
  });
});
