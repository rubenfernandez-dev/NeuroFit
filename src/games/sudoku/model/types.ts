import { Difficulty } from '../../types';

export type SudokuCellPosition = {
  row: number;
  col: number;
};

export type SudokuPuzzle = {
  puzzle: number[];
  solution: number[];
  difficulty: Difficulty;
};

export type SudokuHistoryEntry = {
  row: number;
  col: number;
  prevValue: number;
  nextValue: number;
  prevNotes: number[];
  mistakesDelta: number;
  prevGameOver: boolean;
  prevErrorCell: SudokuCellPosition | null;
};

export type SudokuState = {
  grid: number[][];
  givens: boolean[][];
  notes: number[][][];
  noteMode: boolean;
  history: SudokuHistoryEntry[];
  mistakes: number;
  gameOver: boolean;
  lastErrorCell: SudokuCellPosition | null;
  didWin: boolean;
  sessionStarted: boolean;
};

export type SudokuPersistedState = SudokuState & {
  puzzle: number[];
  solution: number[];
  difficulty: Difficulty;
  elapsedMs: number;
  isDaily?: boolean;
  dailyDateISO?: string;
};