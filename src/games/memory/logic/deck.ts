import { Difficulty } from '../../types';
import { createSeededRng, shuffle } from '../../../shared/utils/random';

export type MemoryCardModel = {
  id: string;
  pairId: string;
  emoji: string;
};

export type MemoryDifficultyConfig = {
  cols: number;
  rows: number;
  previewTimeMs: number;
  mismatchLockMs: number;
};

const symbols = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐰', '🐷', '🐙', '🐢', '🦄', '🐝', '🦋', '🐧', '🐬', '🦖', '🐞'];

const MEMORY_CONFIG_BY_DIFFICULTY: Record<Difficulty, MemoryDifficultyConfig> = {
  // Curva monotónica por tamaño + presión de memoria por preview decreciente.
  principiante: { cols: 4, rows: 4, previewTimeMs: 1800, mismatchLockMs: 0 },
  avanzado: { cols: 5, rows: 4, previewTimeMs: 1400, mismatchLockMs: 350 },
  experto: { cols: 6, rows: 4, previewTimeMs: 1000, mismatchLockMs: 500 },
  maestro: { cols: 6, rows: 6, previewTimeMs: 700, mismatchLockMs: 650 },
  gran_maestro: { cols: 8, rows: 6, previewTimeMs: 450, mismatchLockMs: 800 },
};

export function getMemoryDifficultyConfig(difficulty: Difficulty): MemoryDifficultyConfig {
  return MEMORY_CONFIG_BY_DIFFICULTY[difficulty];
}

export function getBoardSize(difficulty: Difficulty): { cols: number; rows: number } {
  const config = getMemoryDifficultyConfig(difficulty);
  return { cols: config.cols, rows: config.rows };
}

export function buildDeck(difficulty: Difficulty, seed?: number): MemoryCardModel[] {
  const { cols, rows } = getBoardSize(difficulty);
  const pairCount = (cols * rows) / 2;
  const rng = typeof seed === 'number' ? createSeededRng(seed) : Math.random;
  const selected = shuffle(symbols, rng).slice(0, pairCount);

  const pairs = selected.flatMap((emoji, index) => [
    { id: `${index}-a`, pairId: `p${index}`, emoji },
    { id: `${index}-b`, pairId: `p${index}`, emoji },
  ]);

  return shuffle(pairs, rng);
}