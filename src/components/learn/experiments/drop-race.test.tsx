import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DropRace } from "@/components/learn/experiments/drop-race";
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

function drawing(): HTMLElement {
  return screen.getByRole("img", {
    name: "Caída de tres cajas en tres planetas",
  });
}

describe("DropRace", () => {
  it("shows the three planets with their gravity, the boxes still", () => {
    render(<DropRace />);

    for (const text of [
      "Luna",
      "g = 1,6 m/s²",
      "Tierra",
      "g = 9,8 m/s²",
      "Júpiter",
      "g = 24,8 m/s²",
    ]) {
      expect(drawing()).toHaveTextContent(text);
    }
    expect(drawing()).not.toHaveTextContent("Tiempo hasta el suelo");
    expect(screen.getByRole("button", { name: "Soltar" })).toBeEnabled();
  });

  it("drops the boxes, marking each second, until all reach the ground", () => {
    render(<DropRace />);

    fireEvent.click(screen.getByRole("button", { name: "Soltar" }));
    expect(screen.getByRole("button", { name: "Soltar" })).toBeDisabled();
    advanceFrames(1600);

    expect(drawing()).toHaveTextContent("1 s");
    // Jupiter's box lands first, after 1,56 s, and keeps its final speed.
    expect(drawing()).toHaveTextContent("Tiempo hasta el suelo1,6 s");

    advanceFrames(5000);

    expect(drawing()).toHaveTextContent("2,5 s");
    expect(drawing()).not.toHaveTextContent("Marte");
    expect(drawing()).toHaveTextContent("6,1 s");
    expect(drawing()).toHaveTextContent("38,6 m/s");
    expect(
      screen.getByRole("button", { name: "Soltar otra vez" }),
    ).toBeEnabled();
  });

  it("starts again from the top", () => {
    render(<DropRace />);
    fireEvent.click(screen.getByRole("button", { name: "Soltar" }));
    advanceFrames(7000);

    fireEvent.click(screen.getByRole("button", { name: "Soltar otra vez" }));

    expect(drawing()).not.toHaveTextContent("Tiempo hasta el suelo");
  });

  it("moves the boxes and their speeds frame by frame without re-rendering between marks", () => {
    const counted = withCommitCount(<DropRace />);
    render(counted.ui);
    const earthBox = () => drawing().querySelectorAll("rect")[2];
    const before = earthBox()?.getAttribute("y");

    fireEvent.click(screen.getByRole("button", { name: "Soltar" }));
    advanceFrames(100);
    counted.reset();
    advanceFrameByFrame(800);

    expect(counted.commits()).toBe(0);
    expect(earthBox()?.getAttribute("y")).not.toBe(before);
    // 9,8 m/s² for about 0,9 s.
    expect(drawing()).toHaveTextContent("8,8 m/s");
  });
});
