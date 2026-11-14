import { TIME_UNITS_PER_SECOND } from "./playback-config";

/**
 * Simulation time after `elapsedSeconds` of real time at `rate` simulation
 * units per second, times `speed`. It depends on the time elapsed and never
 * on how many frames it was split into.
 */
export function advanceTime(
  simulationTime: number,
  elapsedSeconds: number,
  speed: number,
  rate: number = TIME_UNITS_PER_SECOND,
): number {
  return simulationTime + elapsedSeconds * speed * rate;
}
