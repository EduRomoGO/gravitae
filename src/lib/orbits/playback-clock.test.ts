import { describe, expect, it } from "vitest";
import {
  createPlaybackClock,
  sharedFrameScheduler,
  type FrameScheduler,
  type PlaybackClockOptions,
} from "./playback-clock";
import { TIME_UNITS_PER_SECOND } from "./playback-config";

/** A scheduler whose frames run only when the test says so. */
function manualScheduler() {
  const pending = new Map<number, (now: number) => void>();
  let nextId = 1;
  const scheduler: FrameScheduler = {
    request(callback) {
      const id = nextId++;
      pending.set(id, callback);
      return id;
    },
    cancel(id) {
      pending.delete(id);
    },
  };
  return {
    scheduler,
    /** Runs the frames requested so far at `now`, in milliseconds. */
    frame: (now: number) => {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => {
        callback(now);
      });
    },
    pendingFrames: () => pending.size,
  };
}

/** A clock with a listener, which is what keeps its loop running. */
function listenedClock(options: Omit<PlaybackClockOptions, "scheduler"> = {}) {
  const frames = manualScheduler();
  const clock = createPlaybackClock({
    ...options,
    scheduler: frames.scheduler,
  });
  const ticks: number[] = [];
  const unsubscribe = clock.subscribe((time) => {
    ticks.push(time);
  });
  return { clock, ticks, unsubscribe, ...frames };
}

describe("createPlaybackClock", () => {
  it("starts at the instant it is given", () => {
    const { clock } = listenedClock({ initialTime: 2.5 });

    expect(clock.time()).toBe(2.5);
  });

  it("advances by the real time between frames and notifies each tick", () => {
    const { clock, ticks, frame } = listenedClock();

    frame(1000);
    frame(2000);
    frame(2500);

    expect(clock.time()).toBeCloseTo(1.5 * TIME_UNITS_PER_SECOND, 9);
    expect(ticks).toHaveLength(3);
    expect(ticks[1]).toBeCloseTo(TIME_UNITS_PER_SECOND, 9);
  });

  it("advances twice as far at twice the speed", () => {
    const { clock, frame } = listenedClock({ speed: 2 });

    frame(1000);
    frame(2000);

    expect(clock.time()).toBeCloseTo(2 * TIME_UNITS_PER_SECOND, 9);
  });

  it("advances its rate of simulation time per second, times its speed", () => {
    const { clock, frame } = listenedClock({ rate: 3, speed: 2 });

    frame(1000);
    frame(1500);

    expect(clock.time()).toBeCloseTo(3, 9);
    expect(clock.state()).toEqual({ playing: true, speed: 2 });
  });

  it("takes only one of the reader's speeds", () => {
    const { clock } = listenedClock();

    // @ts-expect-error -- 3× is not one of the speeds the reader can choose.
    clock.setSpeed(3);
  });

  it("changes its rate from the next frame when its speed changes", () => {
    const { clock, frame } = listenedClock();
    frame(1000);
    frame(2000);

    clock.setSpeed(0.5);
    frame(3000);

    expect(clock.time()).toBeCloseTo(1.5 * TIME_UNITS_PER_SECOND, 9);
    expect(clock.state()).toEqual({ playing: true, speed: 0.5 });
  });

  it("requests no frames while it is paused, and stays still", () => {
    const { clock, ticks, frame, pendingFrames } = listenedClock();
    frame(1000);
    frame(2000);

    clock.pause();
    frame(3000);

    expect(pendingFrames()).toBe(0);
    expect(clock.time()).toBeCloseTo(TIME_UNITS_PER_SECOND, 9);
    expect(ticks).toHaveLength(2);
    expect(clock.state().playing).toBe(false);
  });

  it("does not count the time spent paused when it resumes", () => {
    const { clock, frame } = listenedClock({ initialPlaying: false });

    clock.play();
    frame(5000);
    frame(6000);

    expect(clock.time()).toBeCloseTo(TIME_UNITS_PER_SECOND, 9);
  });

  it("starts paused on request", () => {
    const { clock, pendingFrames } = listenedClock({ initialPlaying: false });

    expect(pendingFrames()).toBe(0);
    expect(clock.state()).toEqual({ playing: false, speed: 1 });
  });

  it("goes back to t = 0 on restart and keeps playing", () => {
    const { clock, frame } = listenedClock({ initialTime: 3 });
    frame(1000);

    clock.restart();
    frame(2000);

    expect(clock.time()).toBeCloseTo(TIME_UNITS_PER_SECOND, 9);
  });

  it("notifies once when it restarts while paused", () => {
    const { clock, ticks, frame, pendingFrames } = listenedClock({
      initialTime: 3,
      initialPlaying: false,
    });

    clock.restart();
    frame(1000);

    expect(ticks).toEqual([0]);
    expect(clock.time()).toBe(0);
    expect(pendingFrames()).toBe(0);
  });

  it("stops at its end and stops requesting frames", () => {
    const { clock, frame, pendingFrames } = listenedClock({ until: 0.5 });

    frame(1000);
    frame(2000);
    frame(3000);

    expect(clock.time()).toBe(0.5);
    expect(pendingFrames()).toBe(0);
    expect(clock.state().playing).toBe(true);
  });

  it("stays still when it starts past its end", () => {
    const { clock, frame, pendingFrames } = listenedClock({
      initialTime: 2,
      until: 1,
    });

    frame(1000);

    expect(clock.time()).toBe(2);
    expect(pendingFrames()).toBe(0);
  });

  it("resumes from its end when the end moves away, without counting the wait", () => {
    const { clock, frame } = listenedClock({ until: 0.5 });
    frame(1000);
    frame(2000);

    clock.setUntil(Infinity);
    frame(10_000);
    frame(11_000);

    expect(clock.time()).toBeCloseTo(0.5 + TIME_UNITS_PER_SECOND, 9);
  });

  it("stops again at an end set while it plays", () => {
    const { clock, frame, pendingFrames } = listenedClock();
    frame(1000);
    frame(2000);

    clock.setUntil(1.25);
    frame(3000);

    expect(clock.time()).toBe(1.25);
    expect(pendingFrames()).toBe(0);
  });

  it("runs a single loop however many listeners it has", () => {
    const { clock, frame, pendingFrames } = listenedClock();
    const otherTicks: number[] = [];
    clock.subscribe((time) => {
      otherTicks.push(time);
    });

    frame(1000);

    expect(pendingFrames()).toBe(1);
    expect(otherTicks).toHaveLength(1);
  });

  it("requests frames only while someone listens", () => {
    const frames = manualScheduler();
    const clock = createPlaybackClock({ scheduler: frames.scheduler });
    expect(frames.pendingFrames()).toBe(0);

    const unsubscribe = clock.subscribe(() => undefined);
    expect(frames.pendingFrames()).toBe(1);

    unsubscribe();
    expect(frames.pendingFrames()).toBe(0);
  });

  it("keeps its state snapshot until play, pause or speed change it", () => {
    const { clock } = listenedClock();
    let changes = 0;
    clock.subscribeState(() => {
      changes++;
    });
    const before = clock.state();

    clock.play();
    expect(clock.state()).toBe(before);

    clock.pause();
    clock.setSpeed(2);
    clock.play();

    expect(changes).toBe(3);
    expect(clock.state()).toEqual({ playing: true, speed: 2 });
  });
});

describe("sharedFrameScheduler", () => {
  it("runs the frames of several clocks in one frame of the scheduler under it", () => {
    const frames = manualScheduler();
    const shared = sharedFrameScheduler(frames.scheduler);
    const clocks = [1, 2].map((rate) =>
      createPlaybackClock({ rate, scheduler: shared }),
    );
    const seen: number[][] = clocks.map(() => []);
    clocks.forEach((clock, i) =>
      clock.subscribe((time) => {
        seen[i]?.push(time);
      }),
    );

    expect(frames.pendingFrames()).toBe(1);
    frames.frame(0);
    frames.frame(1000);

    expect(frames.pendingFrames()).toBe(1);
    expect(seen).toEqual([
      [0, 1],
      [0, 2],
    ]);
  });

  it("cancels the frame under it when no clock waits for one", () => {
    const frames = manualScheduler();
    const shared = sharedFrameScheduler(frames.scheduler);
    const first = shared.request(() => undefined);
    const second = shared.request(() => undefined);

    shared.cancel(first);
    expect(frames.pendingFrames()).toBe(1);
    shared.cancel(second);
    expect(frames.pendingFrames()).toBe(0);
  });
});
