import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearLessonProgress,
  createProgressStore,
  progressStorageKey,
} from "@/lib/progress/progress-store";

const KEY = progressStorageKey("leccion");

afterEach(() => {
  localStorage.clear();
});

describe("createProgressStore", () => {
  it("keeps each value for a later store of the same lesson", () => {
    createProgressStore(KEY).set("pasos", 3);

    expect(createProgressStore(KEY).get("pasos")).toBe(3);
    expect(
      createProgressStore(progressStorageKey("otra")).get("pasos"),
    ).toBeUndefined();
  });

  it("gives back the same object until it is set again", () => {
    const store = createProgressStore(KEY);
    store.set("a", { n: 1 });
    const first = store.get("a");

    store.set("b", 2);

    expect(store.get("a")).toBe(first);
  });

  it("tells its listeners about every change, until they leave", () => {
    const store = createProgressStore(KEY);
    const listener = vi.fn();
    const leave = store.subscribe(listener);

    store.set("a", 1);
    store.clear();
    leave();
    store.set("a", 2);

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("starts empty from a saved entry that is not an object", () => {
    localStorage.setItem(KEY, "no es JSON");
    expect(createProgressStore(KEY).get("pasos")).toBeUndefined();

    localStorage.setItem(KEY, "[1, 2]");
    expect(createProgressStore(KEY).get("0")).toBeUndefined();
  });

  it("works in memory when the storage fails", () => {
    const failing = () => {
      throw new Error("blocked");
    };
    const blocked: Storage = {
      length: 0,
      clear: failing,
      getItem: failing,
      key: failing,
      removeItem: failing,
      setItem: failing,
    };
    const store = createProgressStore(KEY, () => blocked);

    store.set("pasos", 2);

    expect(store.get("pasos")).toBe(2);
    store.clear();
    expect(store.get("pasos")).toBeUndefined();
  });

  it("forgets its values when cleared", () => {
    const store = createProgressStore(KEY);
    store.set("pasos", 2);

    store.clear();

    expect(store.get("pasos")).toBeUndefined();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe("the writes of a store", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A storage that counts its writes. */
  function countingStorage() {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    return { setItem, storage: () => localStorage };
  }

  it("go to the storage once for several changes in a row, after them, with the latest values", () => {
    vi.useFakeTimers();
    const { setItem, storage } = countingStorage();
    const store = createProgressStore(KEY, storage);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set("seccion", "a");
    store.set("seccion", "b");
    store.set("chat", { messages: [] });

    expect(listener).toHaveBeenCalledTimes(3);
    expect(store.get("seccion")).toBe("b");
    expect(setItem).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "")).toEqual({
      seccion: "b",
      chat: { messages: [] },
    });
    setItem.mockRestore();
  });

  it("go to the storage at once when the page is hidden or left", () => {
    vi.useFakeTimers();
    const store = createProgressStore(KEY);

    store.set("pasos", 2);
    window.dispatchEvent(new Event("pagehide"));

    expect(JSON.parse(localStorage.getItem(KEY) ?? "")).toEqual({ pasos: 2 });
  });

  it("are dropped when the lesson's progress is forgotten before they go", () => {
    vi.useFakeTimers();
    const store = createProgressStore(KEY);
    store.set("pasos", 2);

    clearLessonProgress("leccion");
    vi.runAllTimers();

    expect(localStorage.getItem(KEY)).toBeNull();

    store.set("pasos", 1);
    vi.runAllTimers();

    expect(JSON.parse(localStorage.getItem(KEY) ?? "")).toMatchObject({
      pasos: 1,
    });
  });
});

describe("progressStorageKey", () => {
  it("names the version of the progress's shape, apart from the older entries", () => {
    expect(progressStorageKey("leccion")).toBe("gravitae:progreso:v3:leccion");
  });
});

describe("clearLessonProgress", () => {
  it("forgets the entries of older versions of the progress", () => {
    localStorage.setItem("gravitae:progreso:leccion", "{}");
    localStorage.setItem("gravitae:progreso:v2:leccion", "{}");
    localStorage.setItem("gravitae:progreso:leccion:ia", "{}");
    localStorage.setItem("gravitae:progreso:v2:leccion", "{}");
    localStorage.setItem("gravitae:progreso:leccion-larga", "{}");

    clearLessonProgress("leccion");

    expect(localStorage.getItem("gravitae:progreso:leccion")).toBeNull();
    expect(localStorage.getItem("gravitae:progreso:v2:leccion")).toBeNull();
    expect(localStorage.getItem("gravitae:progreso:leccion:ia")).toBeNull();
    expect(localStorage.getItem("gravitae:progreso:v2:leccion")).toBeNull();
    expect(
      localStorage.getItem("gravitae:progreso:leccion-larga"),
    ).not.toBeNull();
  });

  it("forgets the lesson's progress, with the entries per mode of older versions, and nothing else", () => {
    localStorage.setItem(progressStorageKey("leccion"), "{}");
    localStorage.setItem(`${progressStorageKey("leccion")}:ia`, "{}");
    localStorage.setItem(progressStorageKey("otra"), "{}");
    localStorage.setItem(progressStorageKey("leccion-larga"), "{}");
    localStorage.setItem("ajeno", "1");

    clearLessonProgress("leccion");

    expect(localStorage.getItem(progressStorageKey("leccion"))).toBeNull();
    expect(
      localStorage.getItem(`${progressStorageKey("leccion")}:ia`),
    ).toBeNull();
    expect(localStorage.getItem(progressStorageKey("otra"))).not.toBeNull();
    expect(
      localStorage.getItem(progressStorageKey("leccion-larga")),
    ).not.toBeNull();
    expect(localStorage.getItem("ajeno")).toBe("1");
  });
});
