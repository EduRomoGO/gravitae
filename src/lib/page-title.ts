export const SITE_NAME = "Gravitae";

/** The title of a page that `name` identifies, followed by the site name. */
export function pageTitle(name: string): string {
  return `${name} · ${SITE_NAME}`;
}

/**
 * Next applies a layout's `title.template` only to the segments below it, so
 * the home, which shares the root layout's segment, builds its title with
 * `pageTitle` instead.
 */
export const siteTitle = {
  default: SITE_NAME,
  template: pageTitle("%s"),
};
