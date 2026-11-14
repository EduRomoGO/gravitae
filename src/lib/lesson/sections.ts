// The ids of the lesson's sections, as app/ley-gravitacion-universal-newton
// renders them. The chat accepts only these as the visible section.
// sections.test.tsx renders the lesson and checks they match.
export const SECTION_IDS = [
  "caida",
  "tiron",
  "planeta",
  "distancia",
  "cualquiera",
  "formula",
  "iguales",
  "mesa",
  "tres",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export function isSectionId(id: string): id is SectionId {
  return SECTION_IDS.some((section) => section === id);
}
