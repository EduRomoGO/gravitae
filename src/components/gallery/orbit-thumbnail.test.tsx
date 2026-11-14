import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GALLERY_LAP_SECONDS,
  GALLERY_LAPS,
} from "@/lib/orbits/playback-config";
import { getSolution, type SolutionSlug } from "@/lib/orbits/solutions";
import { preferReducedMotion } from "@tests/support/reduced-motion";

let GalleryCardLink: typeof import("@/components/gallery/gallery-card-link").GalleryCardLink;
let GalleryPauseButton: typeof import("@/components/gallery/gallery-pause-button").GalleryPauseButton;
let OrbitThumbnail: typeof import("@/components/gallery/orbit-thumbnail").OrbitThumbnail;
let pendingFrames: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let observers: ViewportObserverMock[];

class ViewportObserverMock implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0];
  readonly targets = new Set<Element>();
  disconnected = false;

  constructor(readonly callback: IntersectionObserverCallback) {
    observers.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.disconnected = true;
    this.targets.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

// The gallery's memory (instants and pause) lives in module scope: a fresh
// module per test keeps what one test leaves from reaching the next.
beforeEach(async () => {
  vi.resetModules();
  ({ GalleryCardLink } =
    await import("@/components/gallery/gallery-card-link"));
  ({ GalleryPauseButton } =
    await import("@/components/gallery/gallery-pause-button"));
  ({ OrbitThumbnail } = await import("@/components/gallery/orbit-thumbnail"));
  observers = [];
  vi.stubGlobal("IntersectionObserver", ViewportObserverMock);
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

function runFrames() {
  for (const now of [1000, 2000]) {
    const callbacks = [...pendingFrames.values()];
    pendingFrames.clear();
    act(() => {
      callbacks.forEach((callback) => {
        callback(now);
      });
    });
  }
}

function setOnScreen(isIntersecting: boolean) {
  act(() => {
    observers.forEach((observer) => {
      const entries = [...observer.targets].map((target) => {
        const rect = target.getBoundingClientRect();
        return {
          target,
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          boundingClientRect: rect,
          intersectionRect: rect,
          rootBounds: null,
          time: 0,
        };
      });
      observer.callback(entries, observer);
    });
  });
}

async function renderThumbnail() {
  const { container, unmount } = render(
    <OrbitThumbnail slug="figura-de-ocho" />,
  );
  await waitFor(() => {
    expect(container.querySelector("circle")).not.toBeNull();
  });
  const bodyX = () => container.querySelector("circle")?.getAttribute("cx");
  return { bodyX, unmount };
}

/** Runs frames one second apart, starting at `fromSecond`, for `seconds`. */
function runSeconds(fromSecond: number, seconds: number) {
  for (let second = fromSecond; second <= fromSecond + seconds; second++) {
    const callbacks = [...pendingFrames.values()];
    pendingFrames.clear();
    act(() => {
      callbacks.forEach((callback) => {
        callback(second * 1000);
      });
    });
  }
}

/** A card whose thumbnail reports its instant through the card's departure. */
/** A card, after the gallery's pause button. */
async function renderCard(slug: SolutionSlug) {
  const { container, getByRole } = render(
    <>
      <GalleryPauseButton />
      <GalleryCardLink slug={slug}>
        <OrbitThumbnail slug={slug} />
      </GalleryCardLink>
    </>,
  );
  await waitFor(() => {
    expect(container.querySelector("circle")).not.toBeNull();
  });
  const link = container.querySelector("a");
  if (!link) throw new Error("the card has no link");
  const bodyX = () => container.querySelector("circle")?.getAttribute("cx");
  const pauseButton = () => getByRole("button");
  return { link, bodyX, pauseButton };
}

describe("OrbitThumbnail", () => {
  it("hides its drawing from assistive technology", async () => {
    const { container } = render(<OrbitThumbnail slug="figura-de-ocho" />);
    await waitFor(() => {
      expect(container.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    });
  });

  it("animates its orbit while it is on screen", async () => {
    const { bodyX } = await renderThumbnail();
    setOnScreen(true);
    const startX = bodyX();

    runFrames();

    expect(bodyX()).not.toBe(startX);
  });

  it("shares one frame loop with the other cards on screen, each at its own instant", async () => {
    const { container } = render(
      <>
        <OrbitThumbnail slug="figura-de-ocho" />
        <OrbitThumbnail slug="butterfly-i" />
      </>,
    );
    await waitFor(() => {
      expect(container.querySelectorAll("svg")).toHaveLength(2);
    });
    setOnScreen(true);
    const bodiesX = () =>
      [...container.querySelectorAll("svg")].map((svg) =>
        svg.querySelector("circle")?.getAttribute("cx"),
      );
    const startX = bodiesX();

    runFrames();

    expect(pendingFrames.size).toBe(1);
    const movedX = bodiesX();
    expect(movedX[0]).not.toBe(startX[0]);
    expect(movedX[1]).not.toBe(startX[1]);
  });

  it("stays still before the browser reports it on screen", async () => {
    const { bodyX } = await renderThumbnail();
    const startX = bodyX();

    runFrames();

    expect(bodyX()).toBe(startX);
  });

  it("stops its animation when it leaves the screen", async () => {
    const { bodyX } = await renderThumbnail();
    setOnScreen(true);
    runFrames();
    setOnScreen(false);
    const stoppedX = bodyX();

    runFrames();

    expect(bodyX()).toBe(stoppedX);
  });

  it("stops watching the screen when it unmounts", async () => {
    const { unmount } = await renderThumbnail();

    unmount();

    expect(observers.every(({ disconnected }) => disconnected)).toBe(true);
  });

  it("stops after its laps, wherever the period of its orbit", async () => {
    for (const slug of ["lagrange", "moth-i"] as const) {
      const { bodyX } = await renderCard(slug);
      setOnScreen(true);
      const end = GALLERY_LAPS * GALLERY_LAP_SECONDS;
      runSeconds(0, end + 1);
      const stopped = bodyX();

      runSeconds(end + 2, 5);

      expect(bodyX(), slug).toBe(stopped);
      // After whole laps the bodies are back where they started.
      expect(Number(stopped), slug).toBeCloseTo(
        getSolution(slug).positions[0][0],
        6,
      );
    }
  });

  it("resumes while the pointer is over its card, and stops when it leaves", async () => {
    const { link, bodyX } = await renderCard("goggles");
    setOnScreen(true);
    const end = GALLERY_LAPS * GALLERY_LAP_SECONDS;
    runSeconds(0, end + 1);
    const stopped = bodyX();

    fireEvent.mouseEnter(link);
    runSeconds(end + 2, 2);
    const moved = bodyX();
    fireEvent.mouseLeave(link);
    runSeconds(end + 5, 2);

    expect(moved).not.toBe(stopped);
    expect(bodyX()).toBe(moved);
  });

  it("resumes while the keyboard focus is on its card, and stops when it leaves", async () => {
    const { link, bodyX } = await renderCard("goggles");
    setOnScreen(true);
    const end = GALLERY_LAPS * GALLERY_LAP_SECONDS;
    runSeconds(0, end + 1);
    const stopped = bodyX();

    act(() => {
      link.focus();
    });
    runSeconds(end + 2, 2);
    const moved = bodyX();
    act(() => {
      link.blur();
    });
    runSeconds(end + 5, 2);

    expect(moved).not.toBe(stopped);
    expect(bodyX()).toBe(moved);
  });

  it("freezes at its instant when the gallery is paused, and goes on from there when played", async () => {
    const { bodyX, pauseButton } = await renderCard("goggles");
    setOnScreen(true);
    runSeconds(0, 2);
    fireEvent.click(pauseButton());
    const frozen = bodyX();
    runSeconds(3, 2);
    const whilePaused = bodyX();

    fireEvent.click(pauseButton());
    // The first frame after playing again only starts counting the time.
    runSeconds(6, 0);
    const onResuming = bodyX();
    runSeconds(7, 0);

    expect(whilePaused).toBe(frozen);
    expect(onResuming).toBe(frozen);
    expect(bodyX()).not.toBe(frozen);
  });

  it("stays still under the pointer or the focus while the gallery is paused", async () => {
    const { link, bodyX, pauseButton } = await renderCard("goggles");
    setOnScreen(true);
    fireEvent.click(pauseButton());
    const frozen = bodyX();

    fireEvent.mouseEnter(link);
    act(() => {
      link.focus();
    });
    runSeconds(0, 3);

    expect(bodyX()).toBe(frozen);
  });

  it("starts still, with its whole orbit drawn, when the system asks to reduce motion", async () => {
    preferReducedMotion();
    const { container } = render(<OrbitThumbnail slug="figura-de-ocho" />);
    await waitFor(() => {
      expect(container.querySelector("circle")).not.toBeNull();
    });
    const bodyX = () => container.querySelector("circle")?.getAttribute("cx");
    setOnScreen(true);
    const startX = bodyX();

    runFrames();

    expect(bodyX()).toBe(startX);
    const orbits = container.querySelectorAll('path[data-part="path"]');
    expect(orbits).toHaveLength(3);
    orbits.forEach((orbit) => {
      expect(orbit).toBeVisible();
    });
  });
});
