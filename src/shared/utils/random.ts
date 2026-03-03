export type RNG = () => number;

export function createSeededRng(seed: number): RNG {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(min: number, max: number, rng: RNG = Math.random): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pickOne<T>(items: T[], rng: RNG = Math.random): T {
  return items[Math.floor(rng() * items.length)];
}

export function shuffle<T>(items: T[], rng: RNG = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}