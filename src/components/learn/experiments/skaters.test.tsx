import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Skaters } from "@/components/learn/experiments/skaters";
import {
  advanceFrameByFrame,
  advanceFrames,
  installFakeAnimationFrames,
} from "@tests/support/animation-frames";
import { withCommitCount } from "@tests/support/commit-count";
import { renderAtWidth } from "@tests/support/rendered-width";

beforeEach(() => {
  installFakeAnimationFrames();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Skaters", () => {
  it("shows the same push on both skaters and how fast each one leaves", () => {
    const { container } = render(<Skaters />);

    expect(container).toHaveTextContent(
      "Los dos reciben la misma fuerza: 200 N durante 0,3 s",
    );
    expect(container).toHaveTextContent("El de la izquierda, 40 kg");
    expect(container).toHaveTextContent("Sale a 1,5 m/s");
    expect(container).toHaveTextContent("200 N ÷ 40 kg = 5 m/s²");
    expect(container).toHaveTextContent("El de la derecha, 100 kg");
    expect(container).toHaveTextContent("Sale a 0,6 m/s");
    expect(container).toHaveTextContent(
      "El de 100 kg tiene 2,5 veces la masa del de 40 kg, así que sale 2,5 veces más despacio.",
    );
    expect(container).toHaveTextContent("t = 0,0 s");
  });

  it("pushes them apart for 4 s, the lighter one farther", () => {
    const { container } = render(<Skaters />);

    fireEvent.click(screen.getByRole("button", { name: "Empujarse" }));
    expect(screen.getByRole("button", { name: "Parar" })).toBeInTheDocument();
    advanceFrames(5000);

    expect(container).toHaveTextContent("t = 4,0 s");
    const drawing = screen.getByRole("img", {
      name: "Dos patinadores que se empujan",
    });
    expect(drawing).toHaveTextContent("5,78 m");
    expect(drawing).toHaveTextContent("2,31 m");
    expect(drawing).toHaveTextContent("3 s");
    expect(
      screen.getByRole("button", { name: "Empujarse" }),
    ).toBeInTheDocument();
  });

  it("leaves unlabelled the seconds too close to the previous label", () => {
    render(<Skaters />);
    // 200 kg moves 6 px a second: only one in four marks has room.
    for (let k = 0; k < 5; k++) {
      fireEvent.click(
        screen.getByRole("button", { name: "Más: Masa (derecha)" }),
      );
    }
    fireEvent.click(screen.getByRole("button", { name: "Empujarse" }));
    advanceFrames(5000);

    const labels = screen
      .getByRole("img", { name: "Dos patinadores que se empujan" })
      .querySelectorAll("text");
    const seconds = Array.from(labels, (t) => t.textContent).filter((t) =>
      /^\d s$/.test(t),
    );
    // Left skater (40 kg) labels its 4 marks, the right one only "1 s".
    expect(seconds).toEqual(["1 s", "2 s", "3 s", "4 s", "1 s"]);
  });

  it("stops midway when asked", () => {
    const { container } = render(<Skaters />);
    fireEvent.click(screen.getByRole("button", { name: "Empujarse" }));
    advanceFrames(1000);

    fireEvent.click(screen.getByRole("button", { name: "Parar" }));
    advanceFrames(3000);

    expect(container).toHaveTextContent("t = 1,0 s");
  });

  it("brings them back together when a mass changes on the skater", () => {
    const { container } = render(<Skaters />);
    fireEvent.click(screen.getByRole("button", { name: "Empujarse" }));
    advanceFrames(5000);

    fireEvent.click(
      screen.getByRole("button", { name: "Más: Masa (izquierda)" }),
    );

    expect(container).toHaveTextContent("t = 0,0 s");
    expect(container).toHaveTextContent("El de la izquierda, 60 kg");
    expect(container).toHaveTextContent("200 N ÷ 60 kg = 3,3 m/s²");
  });

  it("stops the mass at 20 kg and 200 kg", () => {
    render(<Skaters />);
    fireEvent.click(
      screen.getByRole("button", { name: "Menos: Masa (izquierda)" }),
    );
    expect(
      screen.getByRole("button", { name: "Menos: Masa (izquierda)" }),
    ).toBeDisabled();
    for (let k = 0; k < 5; k++) {
      fireEvent.click(
        screen.getByRole("button", { name: "Más: Masa (derecha)" }),
      );
    }
    expect(
      screen.getByRole("button", { name: "Más: Masa (derecha)" }),
    ).toBeDisabled();
  });

  it("says when both have the same mass", () => {
    const { container } = render(<Skaters />);
    for (let k = 0; k < 3; k++) {
      fireEvent.click(
        screen.getByRole("button", { name: "Menos: Masa (derecha)" }),
      );
    }
    expect(container).toHaveTextContent(
      "Tienen la misma masa, así que salen igual de rápido.",
    );
  });

  it("brings them back together on request", () => {
    const { container } = render(<Skaters />);
    fireEvent.click(screen.getByRole("button", { name: "Empujarse" }));
    advanceFrames(5000);

    fireEvent.click(screen.getByRole("button", { name: "Volver a juntarse" }));

    expect(container).toHaveTextContent("t = 0,0 s");
  });
});

describe("Skaters on a phone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves the mass controls under the drawing and writes each mass over the head", () => {
    renderAtWidth(300);
    const { container } = render(<Skaters />);
    const drawing = screen.getByRole("img", {
      name: "Dos patinadores que se empujan",
    });

    expect(container).toHaveTextContent("con los botones de debajo");
    expect(drawing).toHaveTextContent("40 kg");
    expect(drawing).toHaveTextContent("100 kg");
    expect(drawing).not.toContainElement(
      screen.getByRole("button", { name: "Más: Masa (izquierda)" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Más: Masa (izquierda)" }),
    );
    expect(drawing).toHaveTextContent("60 kg");
    expect(container).toHaveTextContent("El de la izquierda, 60 kg");
  });

  it("moves them frame by frame without re-rendering between marks", () => {
    const counted = withCommitCount(<Skaters />);
    const { container } = render(counted.ui);
    fireEvent.click(screen.getByRole("button", { name: "Empujarse" }));
    advanceFrames(400);
    counted.reset();

    advanceFrameByFrame(500);

    expect(counted.commits()).toBe(0);
    expect(container).toHaveTextContent("t = 0,9 s");
  });
});
