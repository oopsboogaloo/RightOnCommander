// Fixed-timestep game loop (shell only). The sim advances in whole steps of DT; the display
// renders at its own rate with an interpolation alpha. The accumulator is factored out as a
// pure function so it can be unit-tested without rAF or a wall clock. [design §3, AS-2]

export const DT = 1 / 120; // sim tick: 1/120 s
export const MAX_FRAME_SECONDS = 0.25; // clamp huge gaps (tab switch) to avoid spiral-of-death

// Add the elapsed frame time (clamped), run as many fixed steps as fit, and return the leftover
// accumulator plus the number of steps taken. Pure: no globals, no side effects beyond `step`.
export function drainSteps(
  acc: number,
  frameSeconds: number,
  step: () => void,
  dt: number = DT,
  maxFrame: number = MAX_FRAME_SECONDS,
): { acc: number; steps: number } {
  acc += Math.min(maxFrame, frameSeconds);
  let steps = 0;
  while (acc >= dt) {
    step();
    acc -= dt;
    steps++;
  }
  return { acc, steps };
}

export interface GameLoop {
  stop(): void;
}

export interface GameLoopOptions {
  step: () => void;
  render: (alpha: number) => void;
  dt?: number;
  now?: () => number; // milliseconds; default performance.now
  raf?: (cb: (t: number) => void) => number; // default requestAnimationFrame
  cancel?: (id: number) => void; // default cancelAnimationFrame
}

export function startGameLoop(opts: GameLoopOptions): GameLoop {
  const dt = opts.dt ?? DT;
  const now = opts.now ?? ((): number => performance.now());
  const raf = opts.raf ?? ((cb): number => requestAnimationFrame(cb));
  const cancel = opts.cancel ?? ((id): void => cancelAnimationFrame(id));

  let acc = 0;
  let prev = now();
  let running = true;
  let handle = 0;

  const frame = (): void => {
    if (!running) return;
    const t = now();
    const result = drainSteps(acc, (t - prev) / 1000, opts.step, dt);
    acc = result.acc;
    prev = t;
    opts.render(acc / dt); // alpha in [0, 1) for interpolation
    handle = raf(frame);
  };

  handle = raf(frame);
  return {
    stop(): void {
      running = false;
      cancel(handle);
    },
  };
}
