// Playback values, kept together so the rate and the trail stay in one place.

/** The playback speeds the reader chooses between, as multipliers of the rate. */
export const SPEEDS = [0.5, 1, 2] as const;

export type Speed = (typeof SPEEDS)[number];

/** Simulation time units that go by per real second at 1×, in the detail. */
export const TIME_UNITS_PER_SECOND = 1;

/** Length of the trail behind each body, in simulation time units. */
export const TRAIL_LENGTH = 0.9;

/** Most points a trail is drawn with, which bounds the work done per frame. */
export const MAX_TRAIL_POINTS = 60;

/** Real seconds a gallery card takes to draw one lap, whatever its period. */
export const GALLERY_LAP_SECONDS = 8;

/** Laps a gallery card plays before it stops, until the pointer or the focus is on it. */
export const GALLERY_LAPS = 3;
