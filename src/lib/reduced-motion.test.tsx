import { act, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  prefersReducedMotion,
  subscribeReducedMotion,
  useReducedMotion,
} from "@/lib/reduced-motion";
import { preferReducedMotion } from "@tests/support/reduced-motion";

describe("the reduced motion preference", () => {
  it("is read as the system has it right now", () => {
    expect(prefersReducedMotion()).toBe(false);

    preferReducedMotion();

    expect(prefersReducedMotion()).toBe(true);
  });

  it("tells its subscribers when it changes, until they unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeReducedMotion(listener);

    preferReducedMotion();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    preferReducedMotion();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("renders again a component that reads it when it changes", () => {
    function Motion(): ReactElement {
      return <p>{useReducedMotion() ? "Quieto" : "En movimiento"}</p>;
    }
    render(<Motion />);
    expect(screen.getByText("En movimiento")).toBeInTheDocument();

    act(() => {
      preferReducedMotion();
    });

    expect(screen.getByText("Quieto")).toBeInTheDocument();
  });
});
