import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrbitPlayer } from "@/components/gallery/orbit-player";
import { getSolution } from "@/lib/orbits/solutions";
import { preferReducedMotion } from "@tests/support/reduced-motion";

let pendingFrames: Map<number, FrameRequestCallback>;
let nextFrameId: number;

beforeEach(() => {
  pendingFrames = new Map();
  nextFrameId = 1;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (callback) => {
      const id = nextFrameId++;
      pendingFrames.set(id, callback);
      return id;
    },
  );
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    pendingFrames.delete(id);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function runFrame(now: number) {
  const callbacks = [...pendingFrames.values()];
  pendingFrames.clear();
  act(() => {
    callbacks.forEach((callback) => {
      callback(now);
    });
  });
}

/** The text spans several elements, one per changing value. */
function readout() {
  return screen.getByText(
    (_, element) =>
      element?.tagName === "P" && /^t = /.test(element.textContent),
  );
}

async function renderPlayer() {
  const view = render(<OrbitPlayer slug="figura-de-ocho" />);
  await vi.waitFor(() => {
    expect(view.container.querySelectorAll("circle")).toHaveLength(3);
  });
  return view;
}

describe("OrbitPlayer", () => {
  it("starts playing at 1× with the trail and the full orbit visible", async () => {
    await renderPlayer();

    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1×" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "0,5×" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "2×" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("checkbox", { name: "Estela" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Órbita completa" }),
    ).toBeChecked();
    expect(readout()).toHaveTextContent("t = 0,0 de 6,3 · vuelta 1");
  });

  it("runs a single frame loop while playing, and none while paused", async () => {
    await renderPlayer();
    runFrame(1000);

    expect(pendingFrames.size).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));

    expect(pendingFrames.size).toBe(0);
  });

  it("shows the instant within the lap and the lap it is on", async () => {
    await renderPlayer();

    runFrame(1000);
    runFrame(2000);
    expect(readout()).toHaveTextContent("t = 1,0 de 6,3 · vuelta 1");

    // 8 time units in total: one lap of 6,3259 and 1,6741 into the second.
    runFrame(9000);
    expect(readout()).toHaveTextContent("t = 1,7 de 6,3 · vuelta 2");
  });

  it("stops at the instant it is paused and resumes from it", async () => {
    await renderPlayer();
    runFrame(1000);
    runFrame(2000);

    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    runFrame(3000);
    runFrame(4000);
    expect(readout()).toHaveTextContent("t = 1,0 de 6,3 · vuelta 1");

    fireEvent.click(screen.getByRole("button", { name: "Reproducir" }));
    runFrame(5000);
    runFrame(6000);
    expect(readout()).toHaveTextContent("t = 2,0 de 6,3 · vuelta 1");
    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
  });

  it("goes back to the initial instant on restart, also while paused", async () => {
    const { container } = await renderPlayer();
    runFrame(1000);
    runFrame(2000);
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));

    fireEvent.click(screen.getByRole("button", { name: "Reiniciar" }));
    runFrame(3000);

    expect(readout()).toHaveTextContent("t = 0,0 de 6,3 · vuelta 1");
    const [x] = getSolution("figura-de-ocho").positions[0];
    expect(
      Number(container.querySelector("circle")?.getAttribute("cx")),
    ).toBeCloseTo(x, 9);
    expect(
      screen.getByRole("button", { name: "Reproducir" }),
    ).toBeInTheDocument();
  });

  it.each([
    { name: "0,5×", shown: "t = 0,5 de 6,3 · vuelta 1" },
    { name: "2×", shown: "t = 2,0 de 6,3 · vuelta 1" },
  ])("plays at $name and marks it as active", async ({ name, shown }) => {
    await renderPlayer();

    fireEvent.click(screen.getByRole("button", { name }));
    runFrame(1000);
    runFrame(2000);

    expect(readout()).toHaveTextContent(shown);
    expect(screen.getByRole("button", { name })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "1×" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("hides and shows the trail with its checkbox", async () => {
    const { container } = await renderPlayer();
    const checkbox = screen.getByRole("checkbox", { name: "Estela" });
    const trail = container.querySelector('path[data-part="trail"]');

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(trail).not.toBeVisible();
    expect(container.querySelector('path[data-part="path"]')).toBeVisible();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(trail).toBeVisible();
  });

  it("hides and shows the full orbit with its checkbox", async () => {
    const { container } = await renderPlayer();
    const checkbox = screen.getByRole("checkbox", { name: "Órbita completa" });
    const orbit = container.querySelector('path[data-part="path"]');

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(orbit).not.toBeVisible();
    expect(container.querySelector('path[data-part="trail"]')).toBeVisible();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(orbit).toBeVisible();
  });

  it("starts paused at the initial instant when the visitor asks for reduced motion", async () => {
    preferReducedMotion();
    await renderPlayer();
    runFrame(1000);
    runFrame(2000);

    expect(
      screen.getByRole("button", { name: "Reproducir" }),
    ).toBeInTheDocument();
    expect(readout()).toHaveTextContent("t = 0,0 de 6,3 · vuelta 1");
    expect(
      screen.getByRole("checkbox", { name: "Órbita completa" }),
    ).toBeChecked();
    expect(pendingFrames.size).toBe(0);
  });

  it("announces nothing until a playback button is pressed", async () => {
    await renderPlayer();

    expect(screen.getByRole("status")).toHaveTextContent(/^$/);
  });

  it.each([
    { pressed: ["Pausar"], announced: "En pausa" },
    { pressed: ["Pausar", "Reproducir"], announced: "Reproduciendo" },
    { pressed: ["Reiniciar"], announced: "Reiniciado" },
  ])(
    "announces «$announced» after pressing $pressed",
    async ({ pressed, announced }) => {
      await renderPlayer();

      for (const name of pressed) {
        fireEvent.click(screen.getByRole("button", { name }));
      }

      expect(screen.getByRole("status")).toHaveTextContent(announced);
    },
  );

  it("keeps the lap readout out of the announcements", async () => {
    await renderPlayer();

    expect(readout().closest("[aria-live], [role=status]")).toBeNull();
  });

  it("names the drawing with the shape of the orbit", async () => {
    await renderPlayer();

    expect(
      screen.getByRole("img", {
        name: "Los tres cuerpos recorren, uno tras otro, una misma curva con forma de 8.",
      }),
    ).toBeInTheDocument();
  });
});
