import { integrateLap, type Lap } from "./lap";
import { getSolution, type SolutionSlug } from "./solutions";

// Module scope outlives the components that React unmounts on navigation, so
// the gallery and the detail share each lap until the tab reloads.
const laps = new Map<SolutionSlug, Lap>();

/** Returns one calculated lap of the solution, calculating it the first time. */
export function getLap(slug: SolutionSlug): Lap {
  const cached = laps.get(slug);
  if (cached) return cached;
  const lap = integrateLap(getSolution(slug));
  laps.set(slug, lap);
  return lap;
}
