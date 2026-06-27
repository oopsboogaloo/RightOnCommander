// Seedable PRNG (mulberry32) with explicit state in/out so it can live in the World
// snapshot. Every stochastic draw in sim/ flows through here — Math.random is banned. [ROC-TEST-2]

export interface Rng {
  next(): number; // float in [0, 1)
  int(maxExclusive: number): number; // integer in [0, maxExclusive)
  range(min: number, max: number): number; // float in [min, max)
  getState(): number; // current 32-bit state
  setState(state: number): void;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (maxExclusive: number): number => Math.floor(next() * maxExclusive),
    range: (min: number, max: number): number => min + next() * (max - min),
    getState: (): number => a >>> 0,
    setState: (state: number): void => {
      a = state >>> 0;
    },
  };
}
