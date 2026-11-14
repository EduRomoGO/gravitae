import { afterEach, describe, expect, it } from "vitest";
import { lessonText } from "@/components/learn/atomy/chat-snapshot";

function sectionWith(html: string): HTMLElement {
  const section = document.createElement("section");
  section.innerHTML = html;
  document.body.append(section);
  return section;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("lessonText", () => {
  it("reads the lesson's text without its interface, a space between blocks", () => {
    const section = sectionWith(
      [
        "<h2>Las cajas</h2>",
        "<p>La <strong>masa</strong>, en kg.</p>",
        '<div><button type="button">Lo mismo</button><button type="button">Seis veces menos</button></div>',
        '<form data-atomy-ignore=""><label>¿Por qué lo crees?</label><p>0 de 300 caracteres</p></form>',
        '<div data-atomy-ignore=""><p>Velocidad 0,0 m/s</p></div>',
        '<span aria-hidden="true">·</span><svg><text>Luna</text></svg>',
        "<p hidden>Oculto</p>",
      ].join(""),
    );

    expect(lessonText(section, 6000)).toBe(
      "Las cajas La masa, en kg. Lo mismo Seis veces menos",
    );
  });

  it("stops at its limit", () => {
    expect(lessonText(sectionWith("<p>Uno dos tres</p>"), 7)).toBe("Uno dos");
  });
});
