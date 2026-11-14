import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { preferReducedMotion } from "@tests/support/reduced-motion";

let GalleryPauseButton: typeof import("@/components/gallery/gallery-pause-button").GalleryPauseButton;

// The pause lives in the gallery's memory, in module scope: a fresh module per
// test keeps one test's choice from reaching the next.
beforeEach(async () => {
  vi.resetModules();
  ({ GalleryPauseButton } =
    await import("@/components/gallery/gallery-pause-button"));
});

function renderButton() {
  const view = render(<GalleryPauseButton />);
  const button = () => screen.getByRole("button");
  return { ...view, button };
}

describe("GalleryPauseButton", () => {
  it("offers to pause the animations, announcing nothing yet", () => {
    const { button } = renderButton();

    expect(button()).toHaveAccessibleName("Pausar animaciones");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("pauses the animations and announces it", async () => {
    const { button } = renderButton();

    await userEvent.click(button());

    expect(button()).toHaveAccessibleName("Reproducir animaciones");
    expect(screen.getByRole("status")).toHaveTextContent("En pausa");
  });

  it("plays them again and announces it", async () => {
    const { button } = renderButton();
    await userEvent.click(button());

    await userEvent.click(button());

    expect(button()).toHaveAccessibleName("Pausar animaciones");
    expect(screen.getByRole("status")).toHaveTextContent("Reproduciendo");
  });

  it("offers to play them when the system asks to reduce motion", () => {
    preferReducedMotion();

    const { button } = renderButton();

    expect(button()).toHaveAccessibleName("Reproducir animaciones");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("is still paused after the gallery is left and come back to", async () => {
    const first = renderButton();
    await userEvent.click(first.button());
    first.unmount();

    const back = renderButton();

    expect(back.button()).toHaveAccessibleName("Reproducir animaciones");
  });
});
