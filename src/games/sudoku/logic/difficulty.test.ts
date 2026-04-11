import { describe, expect, it } from 'vitest';
import { SUDOKU_CLUES } from './difficulty';
import { getPuzzle } from './generator';

describe('sudoku difficulty balance', () => {
  it('gran maestro sigue siendo el mas dificil, sin caer en extremo previo', () => {
    expect(SUDOKU_CLUES.gran_maestro).toBeLessThan(SUDOKU_CLUES.maestro);
    expect(SUDOKU_CLUES.gran_maestro).toBeGreaterThanOrEqual(25);
  });

  it('el generador respeta el numero de pistas por dificultad', () => {
    const gm = getPuzzle('gran_maestro', 123);
    const master = getPuzzle('maestro', 123);
    const gmClues = gm.puzzle.filter((value) => value !== 0).length;
    const masterClues = master.puzzle.filter((value) => value !== 0).length;

    expect(gmClues).toBe(SUDOKU_CLUES.gran_maestro);
    expect(masterClues).toBe(SUDOKU_CLUES.maestro);
  });
});
