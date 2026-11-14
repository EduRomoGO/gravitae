import { describe, expect, it } from "vitest";
import {
  ASTRONAUT_SPEEDS,
  SPHERE_MAX_DISTANCE,
  SKATER_MAX_KG,
  SPRING_SCALE_PLANETS,
  THREADS_MAX_DISTANCE,
  THREADS_MAX_MASS,
  TOWER_MAX_DISTANCE,
  WIDGET_STATES,
  isWidgetId,
  type WidgetId,
} from "@/lib/lesson/widgets";

// The experiments take their controls' ranges from these same constants, so
// the state at the top end of every control must pass the widget's schema:
// otherwise the widget would drop out of the snapshot without any error.
const AT_MAX: { readonly [Id in WidgetId]: unknown } = {
  dinamometro: {
    planet: SPRING_SCALE_PLANETS[SPRING_SCALE_PLANETS.length - 1],
  },
  ascensor: { distance: TOWER_MAX_DISTANCE },
  esfera: { distance: SPHERE_MAX_DISTANCE },
  hilos: {
    massA: THREADS_MAX_MASS,
    massB: THREADS_MAX_MASS,
    distance: THREADS_MAX_DISTANCE,
  },
  patinadores: { massA: SKATER_MAX_KG, massB: SKATER_MAX_KG },
  astronautas: { speed: ASTRONAUT_SPEEDS[ASTRONAUT_SPEEDS.length - 1] },
};

describe("WIDGET_STATES", () => {
  it.each(Object.keys(AT_MAX).filter(isWidgetId))(
    "accepts %s at the top end of its controls",
    (id) => {
      expect(WIDGET_STATES[id].safeParse(AT_MAX[id]).success).toBe(true);
    },
  );
});
