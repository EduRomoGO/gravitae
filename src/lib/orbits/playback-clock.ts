import { advanceTime } from "./playback";
import { TIME_UNITS_PER_SECOND, type Speed } from "./playback-config";

/** Requests and cancels frames; `requestAnimationFrame` in the browser. */
export interface FrameScheduler {
  /** Calls `callback` on the next frame with the frame's time, in milliseconds. */
  request(callback: (now: number) => void): number;
  cancel(id: number): void;
}

/** The browser's frame loop, read when a frame is requested, never at import. */
export const animationFrameScheduler: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => {
    cancelAnimationFrame(id);
  },
};

/**
 * Frames for several clocks from one frame of `base`: each request waits for
 * the same next frame, so the gallery's cards, each with its own clock, run
 * one frame loop between them instead of one each.
 */
export function sharedFrameScheduler(base: FrameScheduler): FrameScheduler {
  let waiting = new Map<number, (now: number) => void>();
  let nextId = 1;
  let baseId: number | undefined;
  const run = (now: number) => {
    baseId = undefined;
    // A callback that requests the next frame adds to a new batch.
    const due = waiting;
    waiting = new Map();
    due.forEach((callback) => {
      callback(now);
    });
  };
  return {
    request(callback) {
      const id = nextId++;
      waiting.set(id, callback);
      baseId ??= base.request(run);
      return id;
    },
    cancel(id) {
      waiting.delete(id);
      if (waiting.size === 0 && baseId !== undefined) {
        base.cancel(baseId);
        baseId = undefined;
      }
    },
  };
}

/** What the controls show; a new object each time it changes. */
export interface PlaybackState {
  readonly playing: boolean;
  /** The reader's multiplier of the clock's rate: 1 is 1×. */
  readonly speed: Speed;
}

export interface PlaybackClockOptions {
  /** Instant to start from, in simulation time. Defaults to 0. */
  initialTime?: number;
  /** Defaults to true. */
  initialPlaying?: boolean;
  /**
   * Simulation time units per real second at 1×. Defaults to
   * TIME_UNITS_PER_SECOND; a gallery card passes period / GALLERY_LAP_SECONDS.
   */
  rate?: number;
  /** Defaults to 1. */
  speed?: Speed;
  /**
   * Instant, in simulation time, where playing stops. An instant already past
   * it stays where it is. Defaults to never stopping.
   */
  until?: number;
  scheduler: FrameScheduler;
}

/**
 * Owns the instant shown, in simulation time (it keeps growing past the
 * period), and the only frame loop of a view. Whoever draws subscribes to it.
 */
export interface PlaybackClock {
  time(): number;
  play(): void;
  pause(): void;
  /** Goes back to t = 0, keeping whether it plays. */
  restart(): void;
  setSpeed(speed: Speed): void;
  setUntil(until: number): void;
  /** Calls `listener` on every tick, and once on a restart while paused. */
  subscribe(listener: (time: number) => void): () => void;
  state(): PlaybackState;
  /** Calls `listener` whenever `state()` changes. */
  subscribeState(listener: () => void): () => void;
}

/**
 * Frames are requested only while the clock plays, has not reached its end
 * and someone listens: a view with nothing drawn from it runs no loop.
 */
export function createPlaybackClock({
  initialTime = 0,
  initialPlaying = true,
  rate = TIME_UNITS_PER_SECOND,
  speed: initialSpeed = 1,
  until: initialUntil = Infinity,
  scheduler,
}: PlaybackClockOptions): PlaybackClock {
  let time = initialTime;
  let until = initialUntil;
  let state: PlaybackState = { playing: initialPlaying, speed: initialSpeed };
  const listeners = new Set<(time: number) => void>();
  const stateListeners = new Set<() => void>();
  let frameId: number | undefined;
  /** Time of the previous frame of the running loop, in milliseconds. */
  let previousFrame: number | undefined;

  const notify = () => {
    listeners.forEach((listener) => {
      listener(time);
    });
  };

  const shouldRun = () => state.playing && time < until && listeners.size > 0;

  const stop = () => {
    if (frameId !== undefined) scheduler.cancel(frameId);
    frameId = undefined;
    // The next loop starts counting from its own first frame.
    previousFrame = undefined;
  };

  const onFrame = (now: number) => {
    frameId = undefined;
    if (previousFrame !== undefined) {
      const elapsedSeconds = (now - previousFrame) / 1000;
      time = Math.min(
        advanceTime(time, elapsedSeconds, state.speed, rate),
        until,
      );
    }
    previousFrame = now;
    notify();
    sync();
  };

  /** Starts or stops the loop to match the clock's state. */
  const sync = () => {
    if (!shouldRun()) stop();
    else frameId ??= scheduler.request(onFrame);
  };

  const setState = (next: PlaybackState) => {
    if (next.playing === state.playing && next.speed === state.speed) return;
    state = next;
    stateListeners.forEach((listener) => {
      listener();
    });
  };

  return {
    time: () => time,
    play() {
      setState({ ...state, playing: true });
      sync();
    },
    pause() {
      setState({ ...state, playing: false });
      sync();
    },
    restart() {
      time = 0;
      if (!state.playing) notify();
      sync();
    },
    setSpeed(speed) {
      setState({ ...state, speed });
    },
    setUntil(next) {
      until = next;
      sync();
    },
    subscribe(listener) {
      listeners.add(listener);
      sync();
      return () => {
        listeners.delete(listener);
        sync();
      };
    },
    state: () => state,
    subscribeState(listener) {
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
  };
}
