import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let useOrbitTurn: typeof import("@/components/gallery/orbit-turns").useOrbitTurn;

// The queue lives in module scope: a fresh module per test.
beforeEach(async () => {
  vi.resetModules();
  ({ useOrbitTurn } = await import("@/components/gallery/orbit-turns"));
});

describe("useOrbitTurn", () => {
  it("gives the turn to one card at a time, the next in a task of its own", async () => {
    const first = renderHook(() => useOrbitTurn());
    const second = renderHook(() => useOrbitTurn());
    expect(first.result.current.granted).toBe(true);
    expect(second.result.current.granted).toBe(false);

    act(() => {
      first.result.current.drawn();
    });
    expect(second.result.current.granted).toBe(false);

    await waitFor(() => {
      expect(second.result.current.granted).toBe(true);
    });
  });

  it("passes the turn on when the card that holds it leaves before drawing", async () => {
    const first = renderHook(() => useOrbitTurn());
    const second = renderHook(() => useOrbitTurn());

    first.unmount();

    await waitFor(() => {
      expect(second.result.current.granted).toBe(true);
    });
  });

  it("skips a waiting card that leaves before its turn", async () => {
    const first = renderHook(() => useOrbitTurn());
    const second = renderHook(() => useOrbitTurn());
    const third = renderHook(() => useOrbitTurn());

    second.unmount();
    act(() => {
      first.result.current.drawn();
    });

    await waitFor(() => {
      expect(third.result.current.granted).toBe(true);
    });
  });
});
