import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ProgressProvider,
  usePersistentState,
  WithoutProgress,
} from "@/components/shared/progress";
import {
  createProgressStore,
  progressStorageKey,
  type ProgressStore,
} from "@/lib/progress/progress-store";

const KEY = progressStorageKey("leccion");
const countSchema = z.int().min(0);

afterEach(() => {
  localStorage.clear();
});

function Counter() {
  const [count, update] = usePersistentState("cuenta", 0, countSchema);
  return (
    <button
      type="button"
      onClick={() => {
        update((current) => current + 1);
        update((current) => current + 1);
      }}
    >
      {`Cuenta ${String(count)}`}
    </button>
  );
}

function inProgress(store: ProgressStore, node: React.ReactNode) {
  return (
    <ProgressProvider store={store} restoreScroll={false}>
      {node}
    </ProgressProvider>
  );
}

describe("usePersistentState", () => {
  it("keeps the state for the next mount of the same progress", () => {
    const { unmount } = render(
      inProgress(createProgressStore(KEY), <Counter />),
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("Cuenta 2");
    unmount();

    render(inProgress(createProgressStore(KEY), <Counter />));

    expect(screen.getByRole("button")).toHaveTextContent("Cuenta 2");
  });

  it("starts from the initial value when the saved one is not valid", () => {
    const store = createProgressStore(KEY);
    store.set("cuenta", -1);

    render(inProgress(store, <Counter />));

    expect(screen.getByRole("button")).toHaveTextContent("Cuenta 0");
  });

  it.each([
    ["outside a progress", <Counter key="sin" />],
    [
      "under WithoutProgress",
      inProgress(
        createProgressStore(KEY),
        <WithoutProgress>
          <Counter />
        </WithoutProgress>,
      ),
    ],
  ])("is plain state %s", (_where, node) => {
    render(node);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent("Cuenta 2");
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
