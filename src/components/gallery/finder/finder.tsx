"use client";

// The orbit finder as the reader sees it: one panel with every control (the
// seed, the starting points, starting the motion, closing the orbit and what
// the drawing shows), and the result: the bodies moving along the simulated
// seed's paths until the time ends or two of them collide, or along the
// closed orbit once the correction finds it.
// The result goes below the panel on a phone, out of sight when the reader
// starts the motion or closes the orbit: both bring it into view. From `lg`
// it goes beside the panel and stays in view while the panel scrolls.

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from "react";
import { LapReadout } from "@/components/gallery/lap-readout";
import { OrbitAnimation } from "@/components/gallery/orbit-animation-lazy";
import {
  BUTTON_CLASS,
  SpeedGroup,
  ToggleCheckbox,
} from "@/components/gallery/playback-controls";
import { TrajectoryDrawing } from "@/components/gallery/finder/trajectory-drawing";
import {
  invalidInput,
  useFinder,
  type ClosureState,
  type FinderState,
} from "@/components/gallery/finder/finder-controller";
import {
  usePlaybackClock,
  usePlaybackState,
} from "@/components/gallery/use-playback-clock";
import { PauseIcon, PlayIcon } from "@/components/shared/icons";
import { Spinner } from "@/components/shared/spinner";
import {
  FOCUS_RING_CLASS,
  TEXT_LINK_CLASS,
} from "@/components/shared/link-class";
import {
  formatCoordinate,
  formatLapTime,
  formatSimulationTime,
  formatSmall,
} from "@/lib/format";
import type { Lap, Trajectory } from "@/lib/orbits/lap";
import type { PlaybackClock } from "@/lib/orbits/playback-clock";
import {
  MAX_TIME_LIMITS,
  SEED_LIMITS,
  seedOf,
  type Closure,
  type Seed,
} from "@/lib/orbits/search";
import { getSolution, SOLUTIONS } from "@/lib/orbits/solutions";
import { prefersReducedMotion } from "@/lib/reduced-motion";
import { solutionPath } from "@/lib/routes";

/** The catalogue orbits that start in line, which have a seed. */
const STARTING_POINTS = SOLUTIONS.filter(({ slug }) => seedOf(slug) !== null);
/** Wait after the last change of a control before simulating it. */
const COMMIT_DELAY_MS = 250;
const SEED_STEP = 0.0001;

const INPUT_CLASS = `w-28 rounded-lg border border-slate-500 bg-white px-2 py-1 text-sm tabular-nums dark:bg-slate-900 ${FOCUS_RING_CLASS}`;
const RANGE_CLASS = `w-full accent-violet-600 ${FOCUS_RING_CLASS}`;
const SECONDARY_BUTTON_CLASS = `${BUTTON_CLASS} disabled:opacity-50`;
const PRIMARY_BUTTON_CLASS = `inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 dark:bg-violet-500 dark:text-slate-950 dark:hover:bg-violet-400 ${FOCUS_RING_CLASS}`;

/** What the drawing shows, chosen in the panel. */
interface Display {
  readonly trail: boolean;
  readonly path: boolean;
}

/**
 * What the result plays: the simulated seed's paths, which end, or the
 * closed orbit, which repeats. Null while there is nothing to play.
 */
type Shown =
  | { readonly kind: "trajectory"; readonly trajectory: Trajectory }
  | {
      readonly kind: "orbit";
      readonly closure: Extract<ClosureState, { status: "closed" }>;
    }
  | null;

function shownOf({ simulation, closure }: FinderState): Shown {
  if (closure.status === "closed") return { kind: "orbit", closure };
  if (simulation.status === "done")
    return { kind: "trajectory", trajectory: simulation.result.trajectory };
  return null;
}

/** The object whose change puts the motion back at t = 0, paused. */
function sourceOf(shown: Shown): Trajectory | Lap | null {
  if (!shown) return null;
  return shown.kind === "orbit" ? shown.closure.lap : shown.trajectory;
}

export function Finder(): ReactElement {
  const { state } = useFinder();
  const clock = usePlaybackClock({ initialPlaying: false });
  const [display, setDisplay] = useState<Display>({ trail: true, path: true });
  const shown = shownOf(state);
  const source = sourceOf(shown);
  // The source the reader started; another one has not been started yet.
  const [started, setStarted] = useState<Trajectory | Lap | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  function showResult() {
    resultRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
    });
  }

  // A new trajectory or orbit waits at t = 0 for the reader to start it. An
  // open trajectory stops where it ends; a closed orbit repeats.
  useEffect(() => {
    clock.pause();
    clock.restart();
    clock.setUntil(
      source && "endTime" in source ? source.endTime : Number.POSITIVE_INFINITY,
    );
  }, [clock, source]);

  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <Panel
        clock={clock}
        canStart={source !== null}
        started={source !== null && started === source}
        onStart={() => {
          setStarted(source);
          clock.restart();
          clock.play();
          showResult();
        }}
        onClose={showResult}
        display={display}
        onDisplayChange={setDisplay}
        closed={shown?.kind === "orbit"}
      />
      <Result
        ref={resultRef}
        state={state}
        shown={shown}
        clock={clock}
        display={display}
      />
    </div>
  );
}

function Panel({
  clock,
  canStart,
  started,
  onStart,
  onClose,
  display,
  onDisplayChange,
  closed,
}: {
  clock: PlaybackClock;
  canStart: boolean;
  started: boolean;
  onStart: () => void;
  /** Called when the reader starts closing the orbit. */
  onClose: () => void;
  display: Display;
  onDisplayChange: (display: Display) => void;
  closed: boolean;
}): ReactElement {
  const finder = useFinder();
  const { seed, maxTime } = finder.state;
  // What the reader is typing or dragging; it follows the finder's seed when
  // that changes from elsewhere (a starting point, Atomy, a closure).
  const [draft, setDraft] = useState({ ...seed, maxTime });
  const [shown, setShown] = useState({ seed, maxTime });
  if (shown.seed !== seed || shown.maxTime !== maxTime) {
    setShown({ seed, maxTime });
    setDraft({ ...seed, maxTime });
  }

  // A value out of range stays in its field, marked, and is not simulated.
  const pending =
    (draft.vx !== seed.vx ||
      draft.vy !== seed.vy ||
      draft.maxTime !== maxTime) &&
    invalidInput(draft, draft.maxTime) === null;
  // On the action alone: the finder's state changes while the reader types
  // (a simulation ends), and that must not restart the wait.
  const { setSeed } = finder;
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      void setSeed({ vx: draft.vx, vy: draft.vy }, draft.maxTime);
    }, COMMIT_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [pending, draft, setSeed]);

  return (
    <form
      className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <fieldset>
        <legend className="text-lg font-medium">Semilla</legend>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Velocidad inicial de los dos cuerpos de los extremos; el central parte
          con el doble en sentido contrario.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <SeedField
            label="Velocidad x (vx)"
            value={draft.vx}
            onChange={(vx) => {
              setDraft((previous) => ({ ...previous, vx }));
            }}
          />
          <SeedField
            label="Velocidad y (vy)"
            value={draft.vy}
            onChange={(vy) => {
              setDraft((previous) => ({ ...previous, vy }));
            }}
          />
        </div>
      </fieldset>
      <NumberField
        label="Tiempo simulado"
        hint="unidades de tiempo"
        value={draft.maxTime}
        min={MAX_TIME_LIMITS.min}
        max={MAX_TIME_LIMITS.max}
        step={1}
        onChange={(value) => {
          setDraft((previous) => ({ ...previous, maxTime: value }));
        }}
      />
      <div>
        <p id="partir-de" className="text-sm font-medium">
          Partir de una órbita de la galería
        </p>
        <div
          role="group"
          aria-labelledby="partir-de"
          className="mt-2 flex flex-wrap gap-2"
        >
          {STARTING_POINTS.map(({ slug, name }) => (
            <button
              key={slug}
              type="button"
              className={BUTTON_CLASS}
              onClick={() => {
                void finder.startFrom(slug);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <MotionControls
        clock={clock}
        canStart={canStart}
        started={started}
        onStart={onStart}
      />
      <CloseControl onClose={onClose} />
      <DisplayControls
        clock={clock}
        display={display}
        onDisplayChange={onDisplayChange}
        closed={closed}
      />
    </form>
  );
}

function MotionControls({
  clock,
  canStart,
  started,
  onStart,
}: {
  clock: PlaybackClock;
  canStart: boolean;
  started: boolean;
  onStart: () => void;
}): ReactElement {
  const { playing } = usePlaybackState(clock);
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        disabled={!canStart}
        onClick={onStart}
      >
        <PlayIcon />
        Empezar
      </button>
      <button
        type="button"
        className={SECONDARY_BUTTON_CLASS}
        disabled={!started}
        onClick={() => {
          if (playing) clock.pause();
          else clock.play();
        }}
      >
        {playing && started ? <PauseIcon /> : <PlayIcon />}
        {playing && started ? "Pausar" : "Continuar"}
      </button>
      <span className="text-sm text-slate-600 dark:text-slate-400">
        Los cuerpos recorren la trayectoria desde el instante inicial, aunque
        choquen.
      </span>
    </div>
  );
}

function CloseControl({ onClose }: { onClose: () => void }): ReactElement {
  const finder = useFinder();
  const { simulation, closure } = finder.state;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={SECONDARY_BUTTON_CLASS}
        disabled={
          simulation.status !== "done" ||
          simulation.result.kind !== "open" ||
          simulation.result.bestReturn === null ||
          closure.status === "running"
        }
        onClick={() => {
          void finder.close();
          onClose();
        }}
      >
        Cerrar la órbita
      </button>
      <span className="text-sm text-slate-600 dark:text-slate-400">
        Corrige la semilla y el periodo a partir del mejor regreso hasta que los
        cuerpos vuelvan exactamente al punto de partida.
      </span>
    </div>
  );
}

function DisplayControls({
  clock,
  display,
  onDisplayChange,
  closed,
}: {
  clock: PlaybackClock;
  display: Display;
  onDisplayChange: (display: Display) => void;
  closed: boolean;
}): ReactElement {
  const { speed } = usePlaybackState(clock);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
      <ToggleCheckbox
        checked={display.trail}
        onChange={(trail) => {
          onDisplayChange({ ...display, trail });
        }}
      >
        Estelas
      </ToggleCheckbox>
      <ToggleCheckbox
        checked={display.path}
        onChange={(path) => {
          onDisplayChange({ ...display, path });
        }}
      >
        {closed ? "Órbita completa" : "Trayectoria completa"}
      </ToggleCheckbox>
      <SpeedGroup
        speed={speed}
        onSpeedChange={(value) => {
          clock.setSpeed(value);
        }}
      />
    </div>
  );
}

function SeedField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}): ReactElement {
  const id = useId();
  const errorId = useId();
  const outOfRange = value < SEED_LIMITS.min || value > SEED_LIMITS.max;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-3">
        <input
          type="range"
          aria-label={`${label}, deslizador`}
          className={RANGE_CLASS}
          min={SEED_LIMITS.min}
          max={SEED_LIMITS.max}
          step={SEED_STEP}
          value={value}
          onChange={(event) => {
            onChange(event.target.valueAsNumber);
          }}
        />
        <input
          id={id}
          type="number"
          className={INPUT_CLASS}
          min={SEED_LIMITS.min}
          max={SEED_LIMITS.max}
          step="any"
          value={value}
          aria-invalid={outOfRange}
          aria-describedby={outOfRange ? errorId : undefined}
          onChange={(event) => {
            const next = event.target.valueAsNumber;
            if (Number.isFinite(next)) onChange(next);
          }}
        />
      </div>
      {outOfRange && (
        <RangeError id={errorId} min={SEED_LIMITS.min} max={SEED_LIMITS.max} />
      )}
    </div>
  );
}

/** Why the value of a field is not simulated: it is out of its range. */
function RangeError({
  id,
  min,
  max,
}: {
  id: string;
  min: number;
  max: number;
}): ReactElement {
  return (
    <p id={id} className="mt-1 text-sm text-red-700 dark:text-red-400">
      Fuera de rango: tiene que estar entre {formatCoordinate(min)} y{" "}
      {formatCoordinate(max)}. El resultado sigue siendo el del valor anterior.
    </p>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}): ReactElement {
  const id = useId();
  const errorId = useId();
  const outOfRange = value < min || value > max;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="number"
        className={INPUT_CLASS}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-invalid={outOfRange}
        aria-describedby={outOfRange ? errorId : undefined}
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
      />
      <span className="text-sm text-slate-600 dark:text-slate-400">
        {hint} (de {min} a {max})
      </span>
      {outOfRange && (
        <div className="w-full">
          <RangeError id={errorId} min={min} max={max} />
        </div>
      )}
    </div>
  );
}

function describeSeed({ vx, vy }: Seed): string {
  return `vx = ${formatCoordinate(vx)}, vy = ${formatCoordinate(vy)}`;
}

/** What the page says of the current state, for the live region. */
export function statusOf({ simulation, closure }: FinderState): string {
  if (closure.status === "running") return "Cerrando la órbita…";
  if (closure.status === "closed" || closure.status === "not-closed")
    return closureSummary(closure.result);
  if (closure.status === "failed")
    return "No se pudo cerrar la órbita: el cálculo falló. Vuelve a intentarlo.";
  if (simulation.status === "running") return "Simulando la semilla…";
  if (simulation.status === "failed")
    return "No se pudo simular la semilla: el cálculo falló. Cambia la semilla o el tiempo simulado para intentarlo de nuevo.";
  const { result } = simulation;
  if (result.kind === "collision")
    return `Dos cuerpos chocan con esta semilla en t = ${formatSimulationTime(result.trajectory.endTime)}.`;
  if (result.bestReturn === null)
    return "Los cuerpos no vuelven hacia el punto de partida en el tiempo simulado.";
  return `Mejor regreso en t = ${formatSimulationTime(result.bestReturn.time)}, a una distancia de ${formatSmall(result.bestReturn.distance)}.`;
}

function closureSummary(closure: Closure): string {
  switch (closure.kind) {
    case "closed":
      return `Órbita cerrada: se repite cada ${formatSimulationTime(closure.period)} unidades de tiempo.`;
    case "not-converged":
      return `La corrección no cerró la órbita: la menor distancia alcanzada fue ${formatSmall(closure.error)}.`;
    case "collision":
      return "Dos cuerpos chocan durante la corrección: la órbita no se pudo cerrar.";
  }
}

function Result({
  ref,
  state,
  shown,
  clock,
  display,
}: {
  ref: Ref<HTMLElement>;
  state: FinderState;
  shown: Shown;
  clock: PlaybackClock;
  display: Display;
}): ReactElement {
  const { seed } = state;
  const status = statusOf(state);
  const orbit = shown?.kind === "orbit" ? shown : null;

  return (
    <section
      ref={ref}
      aria-labelledby="resultado"
      // Below the sticky header (scroll-mt-16, lg:top-16) when it is brought
      // into view or stays in view.
      className="mt-6 scroll-mt-16 lg:sticky lg:top-16"
    >
      <h2 id="resultado" className="text-xl font-semibold sm:text-2xl">
        {orbit ? "Órbita cerrada" : "Trayectoria"}
      </h2>
      <p role="status" className="mt-1 text-slate-700 dark:text-slate-300">
        {status}
      </p>
      <div className="mt-4 aspect-square rounded-2xl border border-slate-200 bg-white sm:aspect-[4/3] lg:aspect-square dark:border-slate-800 dark:bg-slate-900/70">
        {orbit ? (
          <OrbitAnimation
            lap={orbit.closure.lap}
            clock={clock}
            showTrail={display.trail}
            showOrbit={display.path}
            label={`Órbita cerrada de la semilla ${describeSeed(orbit.closure.result.seed)}, que se repite cada ${formatSimulationTime(orbit.closure.result.period)} unidades de tiempo.`}
          />
        ) : shown?.kind === "trajectory" ? (
          <TrajectoryDrawing
            trajectory={shown.trajectory}
            clock={clock}
            showTrail={display.trail}
            showPath={display.path}
            label={`Trayectorias de los tres cuerpos con la semilla ${describeSeed(seed)}, hasta ${shown.trajectory.collided ? "que dos cuerpos chocan en " : ""}t = ${formatSimulationTime(shown.trajectory.endTime)}. No forman una órbita cerrada.`}
          />
        ) : (
          <Spinner label="Calculando" />
        )}
      </div>
      {orbit ? (
        <>
          <LapReadout clock={clock} period={orbit.closure.lap.period} />
          <ClosedOrbit result={orbit.closure.result} />
        </>
      ) : shown?.kind === "trajectory" ? (
        <TrajectoryReadout clock={clock} endTime={shown.trajectory.endTime} />
      ) : null}
    </section>
  );
}

/** The instant shown of an open trajectory, written to the DOM on each tick. */
function TrajectoryReadout({
  clock,
  endTime,
}: {
  clock: PlaybackClock;
  endTime: number;
}): ReactElement {
  const timeRef = useRef<HTMLSpanElement>(null);
  const shownEnd = formatLapTime(endTime);

  useEffect(() => {
    const show = (time: number) => {
      const text = formatLapTime(Math.min(time, endTime));
      if (timeRef.current && timeRef.current.textContent !== text)
        timeRef.current.textContent = text;
    };
    show(clock.time());
    return clock.subscribe(show);
  }, [clock, endTime]);

  return (
    <p className="mt-2 text-sm text-slate-600 tabular-nums dark:text-slate-400">
      t ={" "}
      <span
        ref={timeRef}
        className="inline-block text-right"
        style={{ minWidth: `${String(shownEnd.length)}ch` }}
      >
        {formatLapTime(0)}
      </span>{" "}
      de {shownEnd}
    </p>
  );
}

function ClosedOrbit({
  result,
}: {
  result: Extract<Closure, { kind: "closed" }>;
}): ReactElement {
  const match = result.knownMatch;
  const known = match ? getSolution(match.slug) : null;
  return (
    <>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-600 dark:text-slate-400">Semilla</dt>
        <dd className="tabular-nums">{describeSeed(result.seed)}</dd>
        <dt className="text-slate-600 dark:text-slate-400">Una vuelta</dt>
        <dd>{formatSimulationTime(result.period)} unidades de tiempo</dd>
        <dt className="text-slate-600 dark:text-slate-400">Error de cierre</dt>
        <dd>
          {formatSmall(result.error)}, tras {result.iterations}{" "}
          {result.iterations === 1 ? "corrección" : "correcciones"}
        </dd>
      </dl>
      {known && match ? (
        <p className="mt-4">
          Es{" "}
          {match.laps === 1
            ? "la órbita"
            : `${String(match.laps)} vueltas de la órbita`}{" "}
          <Link href={solutionPath(known.slug)} className={TEXT_LINK_CLASS}>
            {known.name}
          </Link>{" "}
          de la galería.
        </p>
      ) : (
        <p className="mt-4">No coincide con ninguna órbita de la galería.</p>
      )}
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        La dirección de esta página lleva la semilla y el periodo: compártela
        para que otra persona vea esta misma órbita.
      </p>
    </>
  );
}
