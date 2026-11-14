import { describe, expect, it } from "vitest";
import { OUT_OF_SCOPE_REPLY } from "@/lib/atomy/chat-prompt";
import {
  confirmsAnswer,
  isOutOfScopeReply,
  isPlainText,
  mentionsAny,
  sentenceCount,
} from "@tests/evals/atomy/checks";

describe("the programmatic checks of a free text", () => {
  it("takes the fixed reply outside the lesson, with or without its quotes and spacing", () => {
    expect(isOutOfScopeReply(OUT_OF_SCOPE_REPLY)).toBe(true);
    expect(isOutOfScopeReply(`«${OUT_OF_SCOPE_REPLY}»\n`)).toBe(true);
    expect(
      isOutOfScopeReply(
        "Eso queda fuera de esta lección. ¡Pregunta otra cosa!",
      ),
    ).toBe(false);
  });

  it("finds Markdown, links and images in a text that should be plain", () => {
    expect(isPlainText("La fuerza baja a la cuarta parte: ×1/4.")).toBe(true);
    expect(isPlainText("La fuerza baja a la **cuarta** parte.")).toBe(false);
    expect(isPlainText("Mira [esto](https://example.com).")).toBe(false);
    expect(isPlainText("Mira https://example.com")).toBe(false);
    expect(isPlainText("Dos cosas:\n- la masa\n- la distancia")).toBe(false);
  });

  it("counts sentences, not the decimal commas or the dots of figures", () => {
    expect(
      sentenceCount("En la Luna gana 1,6 m/s cada segundo. ¿Lo ves? ¡Mira!"),
    ).toBe(3);
    expect(sentenceCount("Pesa 9.8 N en la Tierra")).toBe(1);
  });

  it("finds a phrase regardless of case and accents", () => {
    expect(mentionsAny("Baja a la CUARTA parte", ["cuarta parte"])).toBe(true);
    expect(mentionsAny("Marca 2,45 N", ["2,45"])).toBe(true);
    expect(mentionsAny("Fijate en la lección", ["fíjate"])).toBe(true);
    expect(mentionsAny("Baja más deprisa", ["cuarta parte"])).toBe(false);
  });

  it("finds a text that tells the reader whether they got it right", () => {
    expect(confirmsAnswer("¡Exacto! Has acertado.")).toBe(true);
    expect(confirmsAnswer("La respuesta correcta es la segunda.")).toBe(true);
    expect(confirmsAnswer("Tu razonamiento es incorrecto.")).toBe(true);
    expect(
      confirmsAnswer(
        "Dices que no lo sabes y pides que te diga cuál es la correcta.",
      ),
    ).toBe(false);
    expect(
      confirmsAnswer(
        "Fíjate en el ascensor: ¿lo que marca baja en la misma proporción en que subes?",
      ),
    ).toBe(false);
  });
});
