import { createSeededRng, randomInt } from '../../shared/utils/random';
import { Difficulty } from '../types';

export type NumberMatchDifficultyConfig = {
  rows: number;
  cols: number;
  initialFilled: number;
  addLineCount: number;
  totalSeconds: number;
};

const CONFIG_BY_DIFFICULTY: Record<Difficulty, NumberMatchDifficultyConfig> = {
  principiante: { rows: 6, cols: 6, initialFilled: 18, addLineCount: 6, totalSeconds: 90 },
  // Slightly lower opening density and line pressure from avanzado+ to avoid early hard-locks.
  avanzado: { rows: 6, cols: 7, initialFilled: 20, addLineCount: 6, totalSeconds: 85 },
  experto: { rows: 7, cols: 7, initialFilled: 26, addLineCount: 6, totalSeconds: 80 },
  maestro: { rows: 7, cols: 8, initialFilled: 31, addLineCount: 7, totalSeconds: 78 },
  gran_maestro: { rows: 8, cols: 8, initialFilled: 36, addLineCount: 7, totalSeconds: 75 },
};

export function getNumberMatchConfig(difficulty: Difficulty): NumberMatchDifficultyConfig {
  return CONFIG_BY_DIFFICULTY[difficulty];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function indexToRC(index: number, cols: number): { row: number; col: number } {
  return { row: Math.floor(index / cols), col: index % cols };
}

export function createInitialBoard(rows: number, cols: number, initialFilled: number, seed: number): Array<number | null> {
  const cellCount = rows * cols;
  const safeFilled = clamp(Math.floor(initialFilled), 0, cellCount);
  const rng = createSeededRng(Math.max(1, Math.floor(seed)));
  const board: Array<number | null> = Array.from({ length: cellCount }).map(() => null);

  for (let i = 0; i < safeFilled; i += 1) {
    board[i] = randomInt(1, 9, rng);
  }

  // Shuffle board positions deterministically so fill is not concentrated.
  for (let i = board.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temp = board[i];
    board[i] = board[j];
    board[j] = temp;
  }

  return board;
}

export function canValuesMatch(a: number, b: number): boolean {
  return a === b || a + b === 10;
}

function buildValueCounts(board: Array<number | null>): number[] {
  const counts = Array.from({ length: 10 }, () => 0);
  board.forEach((value) => {
    if (typeof value === 'number' && value >= 1 && value <= 9) counts[value] += 1;
  });
  return counts;
}

function buildCoherentLineValues(board: Array<number | null>, count: number): number[] {
  const counts = buildValueCounts(board);
  const baseValues = Array.from({ length: 9 }, (_, index) => index + 1).filter((value) => counts[value] > 0);
  if (baseValues.length === 0 || count <= 0) return [];

  const preferred: number[] = [];
  baseValues.forEach((value) => {
    preferred.push(value);
    const complement = 10 - value;
    if (complement >= 1 && complement <= 9) preferred.push(complement);
    if (counts[value] >= 2) preferred.push(value);
  });

  const line: number[] = [];
  for (let i = 0; i < count; i += 1) {
    line.push(preferred[i % preferred.length]);
  }
  return line;
}

function findConnectableEmptyPair(
  board: Array<number | null>,
  emptyIndices: number[],
  cols: number,
): [number, number] | null {
  for (let i = 0; i < emptyIndices.length; i += 1) {
    for (let j = i + 1; j < emptyIndices.length; j += 1) {
      const a = emptyIndices[i];
      const b = emptyIndices[j];
      if (isValidMatchConnection(board, a, b, cols)) {
        return [a, b];
      }
    }
  }
  return null;
}

function noNumbersBetweenInRow(board: Array<number | null>, indexA: number, indexB: number, cols: number): boolean {
  const a = indexToRC(indexA, cols);
  const b = indexToRC(indexB, cols);
  if (a.row !== b.row) return false;

  const start = Math.min(a.col, b.col) + 1;
  const end = Math.max(a.col, b.col) - 1;
  for (let col = start; col <= end; col += 1) {
    if (board[a.row * cols + col] !== null) return false;
  }
  return true;
}

function noNumbersBetweenInCol(board: Array<number | null>, indexA: number, indexB: number, cols: number): boolean {
  const a = indexToRC(indexA, cols);
  const b = indexToRC(indexB, cols);
  if (a.col !== b.col) return false;

  const start = Math.min(a.row, b.row) + 1;
  const end = Math.max(a.row, b.row) - 1;
  for (let row = start; row <= end; row += 1) {
    if (board[row * cols + a.col] !== null) return false;
  }
  return true;
}

function areAdjacent(indexA: number, indexB: number, cols: number): boolean {
  const a = indexToRC(indexA, cols);
  const b = indexToRC(indexB, cols);
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr + dc === 1;
}

function areDiagonalAdjacent(indexA: number, indexB: number, cols: number): boolean {
  const a = indexToRC(indexA, cols);
  const b = indexToRC(indexB, cols);
  return Math.abs(a.row - b.row) === 1 && Math.abs(a.col - b.col) === 1;
}

function noNumbersBetweenDiagonal(board: Array<number | null>, indexA: number, indexB: number, cols: number): boolean {
  const a = indexToRC(indexA, cols);
  const b = indexToRC(indexB, cols);
  const dr = b.row - a.row;
  const dc = b.col - a.col;

  if (Math.abs(dr) !== Math.abs(dc) || dr === 0) return false;

  const rowStep = dr > 0 ? 1 : -1;
  const colStep = dc > 0 ? 1 : -1;
  const steps = Math.abs(dr);

  for (let step = 1; step < steps; step += 1) {
    const row = a.row + rowStep * step;
    const col = a.col + colStep * step;
    if (board[row * cols + col] !== null) return false;
  }

  return true;
}

function noNumbersBetweenLinear(board: Array<number | null>, indexA: number, indexB: number): boolean {
  const start = Math.min(indexA, indexB) + 1;
  const end = Math.max(indexA, indexB) - 1;
  for (let index = start; index <= end; index += 1) {
    if (board[index] !== null) return false;
  }
  return true;
}

export function isValidMatchConnection(board: Array<number | null>, indexA: number, indexB: number, cols: number): boolean {
  if (indexA === indexB) return false;
  if (noNumbersBetweenInRow(board, indexA, indexB, cols)) return true;
  if (noNumbersBetweenInCol(board, indexA, indexB, cols)) return true;
  if (noNumbersBetweenDiagonal(board, indexA, indexB, cols)) return true;
  if (noNumbersBetweenLinear(board, indexA, indexB)) return true;
  if (areDiagonalAdjacent(indexA, indexB, cols)) return true;
  return areAdjacent(indexA, indexB, cols);
}

export function hasAnyValidMove(board: Array<number | null>, cols: number): boolean {
  const nonEmpty = board
    .map((value, index) => ({ value, index }))
    .filter((entry): entry is { value: number; index: number } => entry.value !== null);

  for (let i = 0; i < nonEmpty.length; i += 1) {
    for (let j = i + 1; j < nonEmpty.length; j += 1) {
      const a = nonEmpty[i];
      const b = nonEmpty[j];
      if (!canValuesMatch(a.value, b.value)) continue;
      if (isValidMatchConnection(board, a.index, b.index, cols)) return true;
    }
  }

  return false;
}

export function addLineFromRemaining(
  board: Array<number | null>,
  addLineCount: number,
  cols?: number,
): { nextBoard: Array<number | null>; added: number } {
  const existing = board.filter((value): value is number => value !== null);
  if (existing.length === 0 || addLineCount <= 0) {
    return { nextBoard: board, added: 0 };
  }

  const nextBoard = [...board];
  const emptyIndices = nextBoard
    .map((value, index) => ({ value, index }))
    .filter((entry) => entry.value === null)
    .map((entry) => entry.index);

  let writeCursor = 0;
  const toAdd = Math.min(addLineCount, emptyIndices.length);

  // Seed one guaranteed connectable pair when possible to avoid artificial dead states.
  if (typeof cols === 'number' && toAdd >= 2) {
    const pair = findConnectableEmptyPair(nextBoard, emptyIndices, cols);
    if (pair) {
      const [a, b] = pair;
      const pairValue = existing[0];
      nextBoard[a] = pairValue;
      nextBoard[b] = pairValue;
      writeCursor = 2;
      emptyIndices.splice(emptyIndices.indexOf(a), 1);
      emptyIndices.splice(emptyIndices.indexOf(b), 1);
    }
  }

  const remainingSlots = Math.max(0, toAdd - writeCursor);
  const coherentValues = buildCoherentLineValues(board, remainingSlots);
  for (let i = 0; i < remainingSlots; i += 1) {
    nextBoard[emptyIndices[i]] = coherentValues[i] ?? existing[i % existing.length];
  }

  return { nextBoard, added: toAdd };
}

export function computeBoardClearedPercent(board: Array<number | null>): number {
  const total = board.length;
  const empty = board.filter((value) => value === null).length;
  return clamp(Math.round((empty / Math.max(1, total)) * 100), 0, 100);
}

export function computeRewardScoreNumberMatch(input: {
  score: number;
  validMatches: number;
  invalidMatches: number;
  bestCombo: number;
  boardClearedPercent: number;
  linesUsed?: number;
}): number {
  const validMatchesFactor = clamp(input.validMatches / 18, 0, 1) * 100;
  const boardFactor = clamp(input.boardClearedPercent, 0, 100);
  const comboFactor = clamp(input.bestCombo / 7, 0, 1) * 100;
  // Score grows with successful combos and valid matches.
  const survivalFactor = clamp(input.score / 260, 0, 1) * 100;
  const linePressure = clamp((input.linesUsed ?? 0) / 12, 0, 1) * 100;

  // Light penalty model: invalid attempts reduce efficiency, but never dominate reward.
  const weightedAttempts = input.validMatches + input.invalidMatches * 0.35 + 1;
  const executionFactor = clamp((input.validMatches / weightedAttempts) * 100, 0, 100);

  const weighted =
    validMatchesFactor * 0.25 +
    boardFactor * 0.33 +
    survivalFactor * 0.18 +
    comboFactor * 0.1 +
    executionFactor * 0.1 +
    (100 - linePressure) * 0.04;

  return clamp(Math.round(weighted), 0, 100);
}

export function evaluateNumberMatchWin(input: {
  boardClearedPercent: number;
  validMatches: number;
  invalidMatches: number;
}): boolean {
  const efficientEnough = input.validMatches >= 6;
  const clearedEnough = input.boardClearedPercent >= 80;
  const weightedAttempts = input.validMatches + input.invalidMatches * 0.5 + 1;
  const execution = (input.validMatches / weightedAttempts) * 100;
  return clearedEnough && efficientEnough && execution >= 40;
}
