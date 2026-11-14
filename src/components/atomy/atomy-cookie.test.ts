import { afterEach, describe, expect, it } from "vitest";
import {
  ATOMY_INTRO_COOKIE,
  forgetAtomyIntro,
  markAtomyIntroSeen,
} from "@/components/atomy/atomy-cookie";

afterEach(() => {
  forgetAtomyIntro();
});

describe("Atomy's intro cookie", () => {
  it("remembers that the reader has met Atomy", () => {
    markAtomyIntroSeen();

    expect(document.cookie).toContain(`${ATOMY_INTRO_COOKIE}=seen`);
  });

  it("forgets it again", () => {
    markAtomyIntroSeen();

    forgetAtomyIntro();

    expect(document.cookie).not.toContain(ATOMY_INTRO_COOKIE);
  });
});
