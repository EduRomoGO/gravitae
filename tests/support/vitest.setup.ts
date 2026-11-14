import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { dropPendingProgressWrites } from "@/lib/progress/progress-store";
import { matchMedia, resetMotionPreference } from "./reduced-motion";

// jsdom does not implement IntersectionObserver.
class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn((): IntersectionObserverEntry[] => []);
}

vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

// `findBy*` and `waitFor` give up after 1 s by default. `npm run check:full`
// runs unit on the efficiency cores while e2e builds and runs beside it, and
// there a lesson with the chat panel can take longer than 1 s to render an
// answer that is already resolved. The limit stays below the test's own.
configure({ asyncUtilTimeout: 5_000 });

// jsdom does not implement the SMIL timeline of an <svg>, which Atomy pauses
// and resumes. Tests that check those calls spy on them.
Object.assign(SVGSVGElement.prototype, {
  pauseAnimations: () => undefined,
  unpauseAnimations: () => undefined,
});
vi.stubGlobal("matchMedia", matchMedia);

// jsdom does not implement scrolling; the code that scrolls only needs the call.
// Tests that check it spy on it.
Object.assign(Element.prototype, { scrollIntoView: () => undefined });

afterEach(() => {
  cleanup();
  resetMotionPreference();
  dropPendingProgressWrites();
});
