import type { Locator, Page } from "@playwright/test";

export const BODIES_IN_THE_GALLERY = 18;

export function cards(page: Page): Locator {
  return page.locator("main ul > li");
}

export function bodies(page: Page): Locator {
  return page.locator("main ul > li svg circle");
}

/** Which cards changed their drawing during a run of animation frames. */
export function cardsThatMoved(page: Page): Promise<boolean[]> {
  return page.evaluate(
    () =>
      new Promise<boolean[]>((resolve) => {
        const drawings = [...document.querySelectorAll("main ul > li svg")];
        const moved = drawings.map(() => false);
        const observers = drawings.map((drawing, index) => {
          const observer = new MutationObserver(() => {
            moved[index] = true;
          });
          observer.observe(drawing, { attributes: true, subtree: true });
          return observer;
        });
        let frames = 20;
        const onFrame = () => {
          if (--frames > 0) {
            requestAnimationFrame(onFrame);
            return;
          }
          observers.forEach((observer, index) => {
            if (observer.takeRecords().length > 0) moved[index] = true;
            observer.disconnect();
          });
          resolve(moved);
        };
        requestAnimationFrame(onFrame);
      }),
  );
}
