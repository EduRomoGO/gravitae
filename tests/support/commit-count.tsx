import { Profiler, type ReactElement, type ReactNode } from "react";

/**
 * Renders `children` and counts React's commits of them, so a test can tell
 * an animation that re-renders its component every frame from one that
 * draws its frames on the DOM.
 */
export function withCommitCount(children: ReactNode): {
  ui: ReactElement;
  commits: () => number;
  reset: () => void;
} {
  let count = 0;
  return {
    ui: (
      <Profiler
        id="counted"
        onRender={() => {
          count += 1;
        }}
      >
        {children}
      </Profiler>
    ),
    commits: () => count,
    reset: () => {
      count = 0;
    },
  };
}
