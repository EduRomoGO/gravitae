// Classes shared by the links and controls of the site, so the focus ring is
// written once.

/** Outline shown when a control gets the focus from the keyboard. */
export const FOCUS_RING_CLASS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400";

/** Link of a navigation list: underlined only on hover. */
export const NAV_LINK_CLASS = `rounded px-1 underline-offset-4 hover:underline ${FOCUS_RING_CLASS}`;

/** Link inside running text: always underlined. */
export const TEXT_LINK_CLASS = `rounded underline underline-offset-4 ${FOCUS_RING_CLASS}`;
