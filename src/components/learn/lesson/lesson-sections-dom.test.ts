import { afterEach, describe, expect, it, vi } from "vitest";
import {
  sectionAt,
  sectionElement,
  sectionElements,
  sectionInView,
} from "@/components/learn/lesson/lesson-sections-dom";

/** Renders the sections, each `{ id, top }` with its top that far down the viewport. */
function renderSections(
  sections: { id: string; top: number; labelled?: boolean }[],
): void {
  document.body.innerHTML = sections
    .map(({ id, labelled = true }) =>
      labelled
        ? `<section id="${id}" aria-labelledby="${id}-titulo"><h2 id="${id}-titulo">${id}</h2></section>`
        : `<section id="${id}"></section>`,
    )
    .join("");
  for (const { id, top } of sections) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`#${id} is not rendered`);
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 0, y: top, width: 100, height: 500 }),
    );
  }
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("the lesson's sections in the DOM", () => {
  it("are the lesson's sections, in their order, and nothing else", () => {
    renderSections([
      { id: "caida", top: 0 },
      { id: "otra", top: 100 },
      { id: "tiron", top: 200, labelled: false },
      { id: "planeta", top: 300 },
    ]);

    expect(sectionElements().map((section) => section.id)).toEqual([
      "caida",
      "planeta",
    ]);
  });

  it("put at a line the last section whose top is at or above it", () => {
    renderSections([
      { id: "caida", top: -400 },
      { id: "tiron", top: 250 },
      { id: "planeta", top: 600 },
    ]);

    expect(sectionAt(100)).toBe("caida");
    expect(sectionAt(250)).toBe("tiron");
    expect(sectionAt(599)).toBe("tiron");
    expect(sectionAt(700)).toBe("planeta");
  });

  it("put no section at a line above them all", () => {
    renderSections([
      { id: "caida", top: 300 },
      { id: "tiron", top: 900 },
    ]);

    expect(sectionAt(200)).toBeNull();
  });

  it("skip what is not one of the lesson's sections at the line", () => {
    renderSections([
      { id: "caida", top: 0 },
      { id: "otra", top: 100 },
    ]);

    expect(sectionAt(200)).toBe("caida");
  });

  it("put the reader in the section whose top is in the upper 30 % of the screen", () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(1000);
    renderSections([
      { id: "caida", top: -800 },
      { id: "tiron", top: 290 },
      { id: "planeta", top: 310 },
    ]);

    expect(sectionInView()).toBe("tiron");
  });

  it("are found by id while they are shown", () => {
    renderSections([{ id: "caida", top: 0 }]);
    const notASection = document.createElement("div");
    notASection.id = "tiron";
    document.body.append(notASection);

    expect(sectionElement("caida")?.id).toBe("caida");
    expect(sectionElement("tiron")).toBeNull();
    expect(sectionElement("planeta")).toBeNull();
  });
});
