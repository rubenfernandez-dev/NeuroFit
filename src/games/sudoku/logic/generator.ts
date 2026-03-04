import { Difficulty } from '../../types';
import { SudokuPuzzle } from '../model/types';
import { createSeededRng } from '../../../shared/utils/random';

const SOLUTION = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

const cluesByDifficulty: Record<Difficulty, number> = {
  principiante: 46,
  avanzado: 38,
  experto: 31,
  maestro: 27,
  gran_maestro: 23,
};

function toDigits(serialized: string): number[] {
  return serialized.split('').map((value) => Number(value));
}

function buildPuzzle(mask: boolean[]): number[] {
  const puzzle = new Array<number>(81).fill(0);
  for (let i = 0; i < 81; i += 1) {
    puzzle[i] = mask[i] ? Number(SOLUTION[i]) : 0;
  }
  return puzzle;
}

function makeMask(clues: number, rng: () => number): boolean[] {
  const clamped = Math.max(17, Math.min(81, clues));
  const indexes = Array.from({ length: 81 }, (_, index) => index);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }

  const keep = new Set(indexes.slice(0, clamped));
  return Array.from({ length: 81 }, (_, index) => keep.has(index));
}

export function getPuzzle(difficulty: Difficulty, seed?: number): SudokuPuzzle {
  const rng = typeof seed === 'number' ? createSeededRng(seed) : Math.random;
  const clues = cluesByDifficulty[difficulty];
  const mask = makeMask(clues, rng);

  return {
    puzzle: buildPuzzle(mask),
    solution: toDigits(SOLUTION),
    difficulty,
  };
}