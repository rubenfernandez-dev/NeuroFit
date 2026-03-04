import { Difficulty } from '../../types';
import { createSeededRng, randomInt } from '../../../shared/utils/random';

export type Question = {
  text: string;
  answer: number;
};

function makeEasy(rng: () => number): Question {
  const a = randomInt(1, 30, rng);
  const b = randomInt(1, 30, rng);
  if (rng() > 0.5) return { text: `${a} + ${b}`, answer: a + b };
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  return { text: `${max} - ${min}`, answer: max - min };
}

function makeMedium(rng: () => number): Question {
  const choice = randomInt(0, 2, rng);
  if (choice <= 1) return makeEasy(rng);
  const a = randomInt(2, 12, rng);
  const b = randomInt(2, 12, rng);
  return { text: `${a} × ${b}`, answer: a * b };
}

function makeHard(rng: () => number): Question {
  const choice = randomInt(0, 3, rng);
  if (choice === 0) {
    const divisor = randomInt(2, 12, rng);
    const result = randomInt(2, 12, rng);
    const dividend = divisor * result;
    return { text: `${dividend} ÷ ${divisor}`, answer: result };
  }
  return makeMedium(rng);
}

export function generateQuestions(difficulty: Difficulty, count: number, seed?: number): Question[] {
  const rng = typeof seed === 'number' ? createSeededRng(seed) : Math.random;
  const factory = difficulty === 'principiante' ? makeEasy : difficulty === 'avanzado' ? makeMedium : makeHard;

  return Array.from({ length: count }).map(() => factory(rng));
}