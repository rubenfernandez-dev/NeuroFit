import { Difficulty } from '../../types';
import { createSeededRng, shuffle } from '../../../shared/utils/random';

export type MemoryCardModel = {
  id: string;
  pairId: string;
  emoji: string;
};

const symbols = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐰', '🐷', '🐙', '🐢', '🦄', '🐝', '🦋', '🐧', '🐬', '🦖', '🐞'];

export function getBoardSize(difficulty: Difficulty): { cols: number; rows: number } {
  if (difficulty === 'principiante') return { cols: 4, rows: 4 };
  if (difficulty === 'avanzado') return { cols: 6, rows: 4 };
  if (difficulty === 'experto') return { cols: 6, rows: 6 };
  if (difficulty === 'maestro') return { cols: 8, rows: 4 };
  return { cols: 8, rows: 6 };
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