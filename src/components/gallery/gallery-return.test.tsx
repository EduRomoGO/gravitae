import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import type { NextRouter } from "next/router";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionSlug } from "@/lib/orbits/solutions";
import { preferReducedMotion } from "@tests/support/reduced-motion";

let GalleryReturn: typeof import("@/components/gallery/gallery-return").GalleryReturn;
let useCardDeparture: typeof import("@/components/gallery/gallery-return").useCardDeparture;
let useCardInstant: typeof import("@/components/gallery/gallery-return").useCardInstant;
let useGalleryPaused: typeof import("@/components/gallery/gallery-return").useGalleryPaused;
let scrollTo: ReturnType<typeof mockScrollTo>;

// jsdom does not implement window.scrollTo.
function mockScrollTo() {
  return vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
}

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", { value, configurable: true });
}

// The gallery's memory lives in module scope: a fresh module per test keeps
// what one test records from reaching the next.
beforeEach(async () => {
  vi.resetModules();
  ({ GalleryReturn, useCardDeparture, useCardInstant, useGalleryPaused } =
    await import("@/components/gallery/gallery-return"));
  scrollTo = mockScrollTo();
});

afterEach(() => {
  setScrollY(0);
  vi.restoreAllMocks();
});

/** Shows the instant the card starts at, and keeps `leaveAt` when it unmounts. */
function Thumbnail({
  slug,
  leaveAt,
}: {
  slug: SolutionSlug;
  leaveAt: number;
}): ReactElement {
  const { initialInstant, keepInstant } = useCardInstant(slug);
  useEffect(() => {
    keepInstant(() => leaveAt);
  }, [keepInstant, leaveAt]);
  return <span>{`${slug} starts at ${String(initialInstant)}`}</span>;
}

function Card({
  slug,
  leaveAt = 0,
}: {
  slug: SolutionSlug;
  leaveAt?: number;
}): ReactElement {
  const linkProps = useCardDeparture(slug);
  return (
    <Link href={`/galeria/${slug}`} {...linkProps}>
      {slug}
      <Thumbnail slug={slug} leaveAt={leaveAt} />
    </Link>
  );
}

function renderGallery(leaveAt: Partial<Record<SolutionSlug, number>> = {}) {
  // Outside a Next.js app the link only navigates, and so only calls
  // `onNavigate`, under a router. It uses `push` and `prefetch` alone, which
  // makes the rest of NextRouter irrelevant to this fixture.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture: a full NextRouter is irrelevant here (see above).
  const router = {
    push: vi.fn(() => Promise.resolve(true)),
    prefetch: vi.fn(() => Promise.resolve()),
  } as unknown as NextRouter;
  const view = render(
    <RouterContext.Provider value={router}>
      <Card slug="lagrange" leaveAt={leaveAt.lagrange ?? 0} />
      <Card slug="goggles" leaveAt={leaveAt.goggles ?? 0} />
      <GalleryReturn />
    </RouterContext.Provider>,
  );
  const card = (slug: SolutionSlug) =>
    screen.getByRole("link", { name: new RegExp(`^${slug}`) });
  return { ...view, card, router };
}

function PauseToggle(): ReactElement {
  const [paused, setPaused] = useGalleryPaused();
  return (
    <button
      type="button"
      onClick={() => {
        setPaused(!paused);
      }}
    >
      {paused ? "paused" : "playing"}
    </button>
  );
}

function renderPauseToggle() {
  return render(<PauseToggle />);
}

describe("gallery return", () => {
  it("stays at the top without moving the focus when no card was left", () => {
    renderGallery();

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(document.body).toHaveFocus();
  });

  it("returns to the scroll and the card the gallery was left from", async () => {
    const { card, router, unmount } = renderGallery();
    setScrollY(1351);
    await userEvent.click(card("goggles"));
    expect(router.push).toHaveBeenCalledOnce();
    unmount();
    setScrollY(0);
    scrollTo.mockClear();

    const back = renderGallery();

    expect(scrollTo).toHaveBeenCalledWith(0, 1351);
    expect(back.card("goggles")).toHaveFocus();
  });

  it("does not let the focus scroll the page away from the restored position", async () => {
    const { card, unmount } = renderGallery();
    await userEvent.click(card("goggles"));
    unmount();
    const focus = vi.spyOn(HTMLElement.prototype, "focus");

    renderGallery();

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("restores the same card again on a later return, as after Forward and Back", async () => {
    const { card, unmount } = renderGallery();
    await userEvent.click(card("lagrange"));
    unmount();
    renderGallery().unmount();
    document.body.focus();

    const again = renderGallery();

    expect(again.card("lagrange")).toHaveFocus();
  });

  it("scrolls to the part the URL's hash names instead of the scroll and card it was left from", async () => {
    const { card, unmount } = renderGallery();
    setScrollY(1351);
    await userEvent.click(card("goggles"));
    unmount();
    scrollTo.mockClear();
    window.history.replaceState(null, "", "#estabilidad");
    // jsdom does not implement scrollIntoView.
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(
      <>
        <section id="estabilidad" />
        <GalleryReturn />
      </>,
    );

    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.body).toHaveFocus();
    window.history.replaceState(null, "", "#");
  });

  it("ignores a hash it cannot decode and restores the gallery as it was left", () => {
    window.history.replaceState(null, "", "#%E0");

    expect(() => renderGallery()).not.toThrow();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    window.history.replaceState(null, "", "#");
  });

  it("starts a card that was never left at instant 0", () => {
    renderGallery();

    expect(screen.getByText("goggles starts at 0")).toBeInTheDocument();
  });

  it("starts each card at the instant it was left at", () => {
    renderGallery({ lagrange: 3.5, goggles: 7 }).unmount();

    renderGallery();

    expect(screen.getByText("lagrange starts at 3.5")).toBeInTheDocument();
    expect(screen.getByText("goggles starts at 7")).toBeInTheDocument();
  });

  it("plays the cards when nothing was chosen and motion is not reduced", () => {
    renderPauseToggle();

    expect(screen.getByRole("button")).toHaveTextContent("playing");
  });

  it("starts paused when the reader asks the system to reduce motion", () => {
    preferReducedMotion();

    renderPauseToggle();

    expect(screen.getByRole("button")).toHaveTextContent("paused");
  });

  it("follows the reduced motion preference changed with the gallery open", () => {
    renderPauseToggle();

    act(() => {
      preferReducedMotion();
    });

    expect(screen.getByRole("button")).toHaveTextContent("paused");
  });

  it("keeps the pause chosen until the tab is reloaded", async () => {
    const { unmount } = renderPauseToggle();
    await userEvent.click(screen.getByRole("button"));
    unmount();

    renderPauseToggle();

    expect(screen.getByRole("button")).toHaveTextContent("paused");
  });

  it("lets the reader's choice prevail over the reduced motion preference", async () => {
    preferReducedMotion();
    const { unmount } = renderPauseToggle();
    await userEvent.click(screen.getByRole("button"));
    unmount();

    renderPauseToggle();

    expect(screen.getByRole("button")).toHaveTextContent("playing");
  });

  it("keeps the instant the card reads when it unmounts, not when it registers", () => {
    let instant = 1;
    function Counting(): ReactElement {
      const { initialInstant, keepInstant } = useCardInstant("moth-i");
      useEffect(() => {
        keepInstant(() => instant);
      }, [keepInstant]);
      return <span>{`moth-i starts at ${String(initialInstant)}`}</span>;
    }
    const first = render(<Counting />);
    instant = 9;
    first.unmount();

    render(<Counting />);

    expect(screen.getByText("moth-i starts at 9")).toBeInTheDocument();
  });
});
