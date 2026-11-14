import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Atomy,
  useTalkThenIdle,
  type AtomyState,
} from "@/components/atomy/atomy";
import { preferReducedMotion } from "@tests/support/reduced-motion";

// jsdom does not implement the SMIL timeline of an <svg>.
const pauseAnimations = vi.fn();
const unpauseAnimations = vi.fn();

beforeEach(() => {
  Object.assign(SVGSVGElement.prototype, {
    pauseAnimations,
    unpauseAnimations,
  });
});

afterEach(() => {
  pauseAnimations.mockClear();
  unpauseAnimations.mockClear();
});

function drawing(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("Atomy has no drawing");
  return svg;
}

function mouthRunning(): boolean | undefined {
  const pause = pauseAnimations.mock.invocationCallOrder.at(-1) ?? 0;
  const unpause = unpauseAnimations.mock.invocationCallOrder.at(-1) ?? 0;
  if (pause === 0 && unpause === 0) return undefined;
  return unpause > pause;
}

describe("Atomy", () => {
  it.each<AtomyState>(["talking", "idle", "stopped"])(
    "draws its %s state",
    (state) => {
      const { container } = render(<Atomy state={state} />);

      expect(drawing(container)).toHaveAttribute("data-state", state);
    },
  );

  it("is hidden from assistive technology", () => {
    const { container } = render(<Atomy state="talking" />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("applies its class to the wrapper", () => {
    const { container } = render(<Atomy state="idle" className="h-16 w-16" />);

    expect(container.firstElementChild).toHaveClass("block", "h-16", "w-16");
  });

  it("switches state on the same drawing, so its animations do not restart", () => {
    const { container, rerender } = render(<Atomy state="talking" />);
    const before = drawing(container);

    rerender(<Atomy state="idle" />);

    expect(drawing(container)).toBe(before);
    expect(before).toHaveAttribute("data-state", "idle");
  });

  it("moves its mouth only while talking", () => {
    const { rerender } = render(<Atomy state="talking" />);
    expect(mouthRunning()).toBe(true);

    rerender(<Atomy state="idle" />);
    expect(mouthRunning()).toBe(false);

    rerender(<Atomy state="talking" />);
    expect(mouthRunning()).toBe(true);

    rerender(<Atomy state="stopped" />);
    expect(mouthRunning()).toBe(false);
  });

  it("keeps its mouth still while talking with reduced motion", () => {
    preferReducedMotion();

    render(<Atomy state="talking" />);

    expect(mouthRunning()).toBe(false);
  });

  it("stops its mouth when reduced motion is asked while it talks", () => {
    render(<Atomy state="talking" />);

    act(() => {
      preferReducedMotion();
    });

    expect(mouthRunning()).toBe(false);
  });
});

describe("Atomy off screen", () => {
  let scrollTo: ((onScreen: boolean) => void) | undefined;

  beforeEach(() => {
    scrollTo = undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class ViewportObserverMock implements IntersectionObserver {
        readonly root = null;
        readonly rootMargin = "0px";
        readonly scrollMargin = "0px";
        readonly thresholds = [0];

        constructor(callback: IntersectionObserverCallback) {
          scrollTo = (onScreen) => {
            callback(
              [
                {
                  boundingClientRect: new DOMRect(),
                  intersectionRatio: onScreen ? 1 : 0,
                  intersectionRect: new DOMRect(),
                  isIntersecting: onScreen,
                  rootBounds: null,
                  target: document.body,
                  time: 0,
                },
              ],
              this,
            );
          };
        }

        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      },
    );
  });

  function scroll(onScreen: boolean) {
    act(() => {
      scrollTo?.(onScreen);
    });
  }

  it("holds its animations while out of the viewport, and resumes them back in it", () => {
    const { container } = render(<Atomy state="talking" />);
    expect(drawing(container)).not.toHaveAttribute("data-offscreen");

    scroll(false);
    expect(drawing(container)).toHaveAttribute("data-offscreen");
    expect(mouthRunning()).toBe(false);

    scroll(true);
    expect(drawing(container)).not.toHaveAttribute("data-offscreen");
    expect(mouthRunning()).toBe(true);
  });
});

describe("useTalkThenIdle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("talks for 2.5 s by default and then idles", () => {
    const { result } = renderHook(() => useTalkThenIdle());

    act(() => {
      vi.advanceTimersByTime(2499);
    });
    expect(result.current).toBe("talking");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("idle");
  });

  it("talks again, for the time it is given, on a new turn", () => {
    const { result, rerender } = renderHook(
      ({ ms, turn }) => useTalkThenIdle(ms, turn),
      { initialProps: { ms: 4000, turn: 1 } },
    );
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current).toBe("idle");

    rerender({ ms: 1800, turn: 2 });
    expect(result.current).toBe("talking");
    act(() => {
      vi.advanceTimersByTime(1799);
    });
    expect(result.current).toBe("talking");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("idle");
  });

  it("talks for the time it is given", () => {
    const { result } = renderHook(() => useTalkThenIdle(4000));

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(result.current).toBe("talking");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("idle");
  });
});
