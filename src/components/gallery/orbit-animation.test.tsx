import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OrbitAnimation from "@/components/gallery/orbit-animation";
import {
  createPlaybackClock,
  type FrameScheduler,
  type PlaybackClock,
} from "@/lib/orbits/playback-clock";
import { getLap } from "@/lib/orbits/cache";
import { BODY_INDICES, getSolution } from "@/lib/orbits/solutions";
import { lapTrails } from "@/lib/orbits/trail-dash";

const SLUG = "figura-de-ocho";

/** A clock whose frames run only when the test says so. */
function manualClock(
  options: { initialTime?: number; playing?: boolean } = {},
) {
  const pending = new Map<number, (now: number) => void>();
  let nextId = 1;
  const scheduler: FrameScheduler = {
    request(callback) {
      const id = nextId++;
      pending.set(id, callback);
      return id;
    },
    cancel(id) {
      pending.delete(id);
    },
  };
  const clock = createPlaybackClock({
    initialTime: options.initialTime ?? 0,
    initialPlaying: options.playing ?? true,
    scheduler,
  });
  const frame = (now: number) => {
    const callbacks = [...pending.values()];
    pending.clear();
    act(() => {
      callbacks.forEach((callback) => {
        callback(now);
      });
    });
  };
  return { clock, frame, pendingFrames: () => pending.size };
}

function renderAt(time: number, clock?: PlaybackClock) {
  return render(
    <OrbitAnimation
      slug={SLUG}
      clock={clock ?? manualClock({ initialTime: time }).clock}
    />,
  );
}

function bodies(container: HTMLElement) {
  return [...container.querySelectorAll("circle")];
}

function trails(container: HTMLElement) {
  return [...container.querySelectorAll('path[data-part="trail"]')];
}

function orbits(container: HTMLElement) {
  return [...container.querySelectorAll('path[data-part="path"]')];
}

describe("OrbitAnimation", () => {
  it("draws each body at its initial position, with the y axis flipped", () => {
    // The SVG viewBox puts y = 0 at the top row and y grows downwards, while
    // the papers the initial conditions come from use a y axis that grows
    // upwards. Inverting y makes the figure in the app match the one in the
    // papers, so this checks that each body is drawn with its y inverted.
    // Lagrange because the three bodies of the figure-eight start at y = 0.
    const { container } = render(
      <OrbitAnimation slug="lagrange" clock={manualClock().clock} />,
    );

    expect(bodies(container)).toHaveLength(3);
    getSolution("lagrange").positions.forEach(([x, y], body) => {
      const circle = bodies(container)[body];
      expect(Number(circle?.getAttribute("cx"))).toBeCloseTo(x, 9);
      expect(Number(circle?.getAttribute("cy"))).toBeCloseTo(-y, 9);
    });
  });

  it("draws each trail as a dash of its body's orbit, from one trail length behind the body up to it", () => {
    const { container } = renderAt(1);
    const expected = lapTrails(getLap(SLUG));

    expect(trails(container)).toHaveLength(3);
    trails(container).forEach((trail, body) => {
      const total = expected.pathLengths[body] ?? NaN;
      const { offset, length } = expected.dashAt(1, BODY_INDICES[body] ?? 0);
      expect(trail.getAttribute("d")).toBe(
        orbits(container)[body]?.getAttribute("d"),
      );
      expect(Number(trail.getAttribute("pathLength"))).toBeCloseTo(total, 9);
      const [dash, gap] = (trail.getAttribute("stroke-dasharray") ?? "")
        .split(" ")
        .map(Number);
      expect(dash).toBeCloseTo(length, 9);
      expect(gap).toBeCloseTo(total - length, 9);
      expect(Number(trail.getAttribute("stroke-dashoffset"))).toBeCloseTo(
        -offset,
        9,
      );
    });
  });

  it("draws the full orbit as curves", () => {
    const { container } = renderAt(1);

    expect(orbits(container)).toHaveLength(3);
    orbits(container).forEach((path) => {
      expect(path.getAttribute("d")).toMatch(/^M[^LC]+C/);
    });
  });

  it("starts from the clock's instant", () => {
    const { container: atStart } = renderAt(0);
    const { container: later } = renderAt(1);

    expect(bodies(later)[0]?.getAttribute("cx")).not.toBe(
      bodies(atStart)[0]?.getAttribute("cx"),
    );
  });

  it("redraws on each tick of its clock", () => {
    const { clock, frame } = manualClock();
    const { container } = renderAt(0, clock);
    const startX = bodies(container)[0]?.getAttribute("cx");

    frame(1000);
    frame(2000);

    expect(bodies(container)[0]?.getAttribute("cx")).not.toBe(startX);
  });

  it("redraws t = 0 when its clock restarts while paused", () => {
    const { clock } = manualClock({ initialTime: 0.5, playing: false });
    const { container } = renderAt(0, clock);

    act(() => {
      clock.restart();
    });

    const [x] = getSolution(SLUG).positions[0];
    expect(Number(bodies(container)[0]?.getAttribute("cx"))).toBeCloseTo(x, 9);
  });

  it("hides the trails and the full orbit on request", () => {
    const { container } = render(
      <OrbitAnimation
        slug={SLUG}
        clock={manualClock().clock}
        showTrail={false}
        showOrbit={false}
      />,
    );

    trails(container).forEach((trail) => {
      expect(trail).not.toBeVisible();
    });
    orbits(container).forEach((orbit) => {
      expect(orbit).not.toBeVisible();
    });
  });

  it("hides only what it is asked to hide", () => {
    const { clock } = manualClock();
    const { container, rerender } = render(
      <OrbitAnimation slug={SLUG} clock={clock} showTrail={false} />,
    );
    const [trail] = trails(container);
    const [orbit] = orbits(container);

    expect(trail).not.toBeVisible();
    expect(orbit).toBeVisible();

    rerender(<OrbitAnimation slug={SLUG} clock={clock} showOrbit={false} />);

    expect(trail).toBeVisible();
    expect(orbit).not.toBeVisible();
  });

  it("stops listening to its clock when it unmounts", () => {
    const { clock, pendingFrames } = manualClock();
    const { unmount } = renderAt(0, clock);
    expect(pendingFrames()).toBe(1);

    unmount();

    expect(pendingFrames()).toBe(0);
  });
});
