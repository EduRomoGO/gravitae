import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Finder } from "@/components/gallery/finder/finder";
import {
  FinderProvider,
  orbitUrl,
  sharedOrbit,
  useFinder,
  type FinderController,
} from "@/components/gallery/finder/finder-controller";
import {
  finderSnapshotOf,
  finderSurface,
} from "@/components/gallery/finder/finder-surface";
import { PERIOD_LIMITS, type Seed } from "@/lib/orbits/search";
import { inlineSearcher, type Searcher } from "@/lib/orbits/search-client";
import { preferReducedMotion } from "@tests/support/reduced-motion";

const CLOSING = 20_000;

beforeEach(() => {
  window.history.replaceState(null, "", "/galeria/buscar");
  // The player's clock is not driven here: its first frame never comes.
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

let finder: FinderController | null = null;

/** Hands the test the finder's controller after each render. */
function Spy({
  onFinder,
}: {
  onFinder: (controller: FinderController) => void;
}) {
  const controller = useFinder();
  useEffect(() => {
    onFinder(controller);
  });
  return null;
}

function renderFinder(searcher: () => Searcher = inlineSearcher) {
  return render(
    <FinderProvider searcher={searcher}>
      <Finder />
      <Spy
        onFinder={(controller) => {
          finder = controller;
        }}
      />
    </FinderProvider>,
  );
}

/** The finder's own live region, the first in its section: the player has another. */
function status() {
  const [first] = within(
    screen.getByRole("region", { name: /Trayectoria|Órbita cerrada/ }),
  ).getAllByRole("status");
  if (!first) throw new Error("no status");
  return first;
}

describe("Finder", () => {
  it("simulates the first seed and draws its trajectory", async () => {
    renderFinder();

    await waitFor(() => {
      expect(status()).toHaveTextContent(/^Mejor regreso en t = 6,/);
    });
    expect(
      screen.getByRole("img", { name: /Trayectorias de los tres cuerpos/ }),
    ).toBeInTheDocument();
  });

  it(
    "closes the orbit, plays it and writes it to the URL",
    async () => {
      renderFinder();
      await waitFor(() => {
        expect(status()).toHaveTextContent(/^Mejor regreso/);
      });
      const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");

      fireEvent.click(screen.getByRole("button", { name: "Cerrar la órbita" }));

      expect(scrollIntoView).toHaveBeenCalledOnce();
      expect(scrollIntoView.mock.contexts[0]).toBe(
        screen.getByRole("region", { name: "Trayectoria" }),
      );

      await waitFor(
        () => {
          expect(status()).toHaveTextContent(
            "Órbita cerrada: se repite cada 6,33 unidades de tiempo.",
          );
        },
        { timeout: CLOSING },
      );
      expect(screen.getByText(/Es la órbita/)).toHaveTextContent(
        "Es la órbita Figura de ocho de la galería.",
      );
      expect(sharedOrbit(window.location.search)?.period).toBeCloseTo(
        6.3259,
        3,
      );
    },
    CLOSING,
  );

  it("waits for the reader to start the motion, and then plays it", async () => {
    renderFinder();
    const start = screen.getByRole("button", { name: "Empezar" });
    const pause = () =>
      screen.getByRole("button", { name: /Pausar|Continuar/ });
    await waitFor(() => {
      expect(start).toBeEnabled();
    });
    expect(pause()).toBeDisabled();

    fireEvent.click(start);

    expect(pause()).toHaveAccessibleName("Pausar");
    fireEvent.click(pause());
    expect(pause()).toHaveAccessibleName("Continuar");
  });

  it("brings the result into view when the motion starts", async () => {
    renderFinder();
    const start = screen.getByRole("button", { name: "Empezar" });
    await waitFor(() => {
      expect(start).toBeEnabled();
    });
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");

    fireEvent.click(start);

    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      behavior: "smooth",
      block: "nearest",
    });
    expect(scrollIntoView.mock.contexts[0]).toBe(
      screen.getByRole("region", { name: "Trayectoria" }),
    );
  });

  it("brings the result into view without motion when the system asks for less", async () => {
    preferReducedMotion();
    renderFinder();
    const start = screen.getByRole("button", { name: "Empezar" });
    await waitFor(() => {
      expect(start).toBeEnabled();
    });
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");

    fireEvent.click(start);

    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      behavior: "auto",
      block: "nearest",
    });
  });

  it("draws the trajectory up to the collision", async () => {
    renderFinder();
    await waitFor(() => {
      expect(finder?.current().simulation.status).toBe("done");
    });

    void finder?.setSeed({ vx: 0, vy: 0 });

    await waitFor(() => {
      expect(status()).toHaveTextContent(
        /^Dos cuerpos chocan con esta semilla en t = /,
      );
    });
    expect(
      screen.getByRole("img", { name: /hasta que dos cuerpos chocan/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Empezar" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Cerrar la órbita" }),
    ).toBeDisabled();
  });

  it("hides the whole paths and the trails", async () => {
    const { container } = renderFinder();
    await waitFor(() => {
      expect(finder?.current().simulation.status).toBe("done");
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Estelas" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Trayectoria completa" }),
    );

    for (const part of ["trail", "path"])
      expect(
        container.querySelector(`path[data-part="${part}"]`)?.parentElement,
      ).toHaveStyle({ display: "none" });
  });

  it("starts from a catalogue orbit's seed", async () => {
    renderFinder();
    fireEvent.click(screen.getByRole("button", { name: "Moth I" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Velocidad x (vx)")).toHaveValue(
        0.4644451728,
      );
    });
    await waitFor(() => {
      expect(status()).toHaveTextContent(/^Mejor regreso en t = 14,89/);
    });
  });

  it("refuses a seed outside the limits", async () => {
    renderFinder();
    await waitFor(() => {
      expect(finder).not.toBeNull();
    });
    const result = await finder?.setSeed({ vx: 2, vy: 0 });
    expect(result).toEqual({
      ok: false,
      error: "vx and vy must be between -1 and 1.",
    });
  });

  it("keeps the wait for the reader's typing when a simulation ends meanwhile", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const seeds: Seed[] = [];
    let release = () => {};
    // The first simulation ends only when the test releases it.
    const heldSearcher = (): Searcher => {
      const inner = inlineSearcher();
      return {
        simulate: (seed, maxTime) => {
          seeds.push(seed);
          const outcome = inner.simulate(seed, maxTime);
          if (seeds.length > 1) return outcome;
          return new Promise((resolve) => {
            release = () => {
              resolve(outcome);
            };
          });
        },
        close: (seed, period) => inner.close(seed, period),
        dispose: () => {
          inner.dispose();
        },
      };
    };
    try {
      render(
        <FinderProvider searcher={heldSearcher}>
          <Finder />
        </FinderProvider>,
      );
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(seeds).toHaveLength(1);

      fireEvent.change(screen.getByLabelText("Velocidad x (vx)"), {
        target: { value: "0.2" },
      });
      await act(() => vi.advanceTimersByTimeAsync(150));
      release();
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(seeds).toHaveLength(1);
      await act(() => vi.advanceTimersByTimeAsync(100));

      expect(seeds).toHaveLength(2);
      expect(seeds[1]?.vx).toBe(0.2);
    } finally {
      vi.useRealTimers();
    }
  });

  it(
    "closes the orbit a shared URL names on load",
    async () => {
      window.history.replaceState(
        null,
        "",
        "/galeria/buscar?vx=0.3471168881&vy=0.5327249454&t=6.3259139829",
      );
      renderFinder();

      await waitFor(
        () => {
          expect(status()).toHaveTextContent(/^Órbita cerrada/);
        },
        { timeout: CLOSING },
      );
      expect(screen.getByText(/tras 0 correcciones/)).toBeInTheDocument();
    },
    CLOSING,
  );

  it("leaves the shared orbit unclosed when the reader changes the seed while it loads", async () => {
    window.history.replaceState(
      null,
      "",
      "/galeria/buscar?vx=0.3471168881&vy=0.5327249454&t=6.3259139829",
    );
    renderFinder();
    expect(finder?.current().simulation.status).toBe("running");

    void finder?.setSeed({ vx: 0.4, vy: 0.5 });

    await waitFor(() => {
      expect(finder?.current().simulation.status).toBe("done");
    });
    expect(finder?.current()).toMatchObject({
      seed: { vx: 0.4, vy: 0.5 },
      closure: { status: "idle" },
    });
    expect(
      screen.getByRole("button", { name: "Cerrar la órbita" }),
    ).toBeEnabled();
  });

  it("says that the calculation failed instead of waiting for it", async () => {
    const failing = (): Searcher => ({
      simulate: () =>
        Promise.resolve({ kind: "failed", error: "The worker did not load." }),
      close: () =>
        Promise.resolve({ kind: "failed", error: "The worker did not load." }),
      dispose: () => undefined,
    });
    renderFinder(failing);

    await waitFor(() => {
      expect(status()).toHaveTextContent(/^No se pudo simular la semilla/);
    });
    expect(
      screen.getByRole("button", { name: "Cerrar la órbita" }),
    ).toBeDisabled();
    expect(await finder?.setSeed({ vx: 0.1, vy: 0.2 })).toEqual({
      ok: false,
      error: "The simulation failed: The worker did not load.",
    });
  });

  it("marks a value out of range in its field and keeps the seed", async () => {
    renderFinder();
    await waitFor(() => {
      expect(finder?.current().simulation.status).toBe("done");
    });
    const field = screen.getByLabelText("Velocidad x (vx)");

    fireEvent.change(field, { target: { value: "2" } });

    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(
      /^Fuera de rango: tiene que estar entre −1 y 1\./,
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(finder?.current().seed.vx).toBe(0.36);
    expect(finder?.current().simulation.status).toBe("done");

    fireEvent.change(field, { target: { value: "0.5" } });

    expect(field).toHaveAttribute("aria-invalid", "false");
    await waitFor(() => {
      expect(finder?.current().seed.vx).toBe(0.5);
    });
  });
});

describe("the finder as Atomy reaches it", () => {
  it("snapshots the finder's state and runs its tools", async () => {
    renderFinder();
    await waitFor(() => {
      expect(finder?.current().simulation.status).toBe("done");
    });
    const surface = finderSurface(finder);

    const result = await surface.tools.start_from({ orbit: "goggles" });
    expect(result).toMatchObject({
      ok: true,
      output: { seed: { vx: 0.0833000718 }, outcome: "open" },
    });
    expect(surface.snapshot()).toEqual({
      snapshot: finderSnapshotOf(finder?.current() ?? expect.fail("no finder")),
    });
    expect(await surface.tools.go_to_section({ section: "caida" })).toEqual({
      ok: false,
      error: 'The tool "go_to_section" does not belong to this page.',
    });
  });

  it("has nothing to send without the finder", () => {
    expect(finderSurface(null).snapshot()).toBeNull();
  });
});

describe("the shared URL", () => {
  it("carries a closed orbit and reads it back", () => {
    const url = orbitUrl(
      { pathname: "/galeria/buscar" },
      { seed: { vx: 0.1, vy: -0.2 }, period: 7 },
    );
    expect(url).toBe("/galeria/buscar?vx=0.1&vy=-0.2&t=7");
    expect(sharedOrbit(url.slice(url.indexOf("?")))).toEqual({
      seed: { vx: 0.1, vy: -0.2 },
      period: 7,
    });
  });

  it("ignores parameters out of range or missing", () => {
    expect(sharedOrbit("?vx=3&vy=0.2&t=7")).toBeNull();
    expect(sharedOrbit("?vx=0.1&vy=0.2")).toBeNull();
    expect(sharedOrbit("")).toBeNull();
  });

  it("accepts the periods a closure can reach, and no shorter one", () => {
    const at = (period: number) =>
      sharedOrbit(`?vx=0.1&vy=0.2&t=${String(period)}`)?.period ?? null;

    expect(at(PERIOD_LIMITS.min)).toBe(PERIOD_LIMITS.min);
    expect(at(PERIOD_LIMITS.min - 0.01)).toBeNull();
    expect(at(PERIOD_LIMITS.max + 0.01)).toBeNull();
  });
});
