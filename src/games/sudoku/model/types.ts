import { Difficulty } from '../../types';

export type SudokuPuzzle = {
  puzzle: number[];
  solution: number[];
  difficulty: Difficulty;
};

export type SudokuPersistedState = {
  grid: number[];
  puzzle: number[];
  solution: number[];
  difficulty: Difficulty;
  elapsedMs: number;
  isDaily?: boolean;
  dailyDateISO?: string;
};