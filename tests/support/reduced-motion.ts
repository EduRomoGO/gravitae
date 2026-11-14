import { REDUCED_MOTION_QUERY } from "@/lib/reduced-motion";

// jsdom does not implement window.matchMedia. The setup installs this fake,
// which answers `prefers-reduced-motion: reduce` as each test sets it.

let reduced = false;

const lists = new Set<FakeMediaQueryList>();

/**
 * Makes the system ask for reduced motion until the test ends, and tells the
 * lists already handed out, as the browser does when the setting changes.
 */
export function preferReducedMotion(): void {
  reduced = true;
  lists.forEach((list) => {
    list.dispatchEvent(new Event("change"));
  });
}

export function resetMotionPreference(): void {
  reduced = false;
  lists.clear();
}

class FakeMediaQueryList extends EventTarget implements MediaQueryList {
  onchange = null;

  constructor(readonly media: string) {
    super();
  }

  get matches(): boolean {
    return this.media === REDUCED_MOTION_QUERY && reduced;
  }

  addListener(): void {
    // Deprecated API, unused by the app.
  }

  removeListener(): void {
    // Deprecated API, unused by the app.
  }
}

export function matchMedia(query: string): MediaQueryList {
  const list = new FakeMediaQueryList(query);
  lists.add(list);
  return list;
}
