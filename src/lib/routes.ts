// The app's internal routes, written once: the header, the links and the
// pages take them from here. With typedRoutes (next.config.ts), each one is
// checked against the routes under src/app, so a typo or a renamed route
// fails the typecheck instead of linking to a 404.

import type { Route } from "next";
import type { SolutionSlug } from "@/lib/orbits/solutions";

export const HOME_PATH = "/" satisfies Route;
export const LESSON_PATH = "/ley-gravitacion-universal-newton" satisfies Route;
export const GALLERY_PATH = "/galeria" satisfies Route;
export const FINDER_PATH = "/galeria/buscar" satisfies Route;

/** A solution's detail in the gallery. */
export function solutionPath(
  slug: SolutionSlug,
): Route<`/galeria/${SolutionSlug}`> {
  return `/galeria/${slug}`;
}

/** A section of the gallery's page, by its anchor. */
export function galleryAnchorPath(anchor: string): Route {
  return `${GALLERY_PATH}#${anchor}`;
}
