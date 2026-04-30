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
  // Advanced tiers intentionally start denser to force deeper planning from move one.
  avanzado: { rows: 6, cols: 7, initialFilled: 23, addLineCount: 7, totalSeconds: 80 },
  experto: { rows: 7, cols: 7, initialFilled: 30, addLineCount: 7, totalSeconds: 76 },
  maestro: { rows: 7, cols: 8, initialFilled: 36, addLineCount: 8, totalSeconds: 72 },
  gran_maestro: { rows: 8, cols: 8, initialFilled: 42, addLineCount: 8, totalSeconds: 68 },
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
  const emptyBoard: Array<number | null> = Array.from({ length: cellCount }).map(() => null);

  if (safeFilled === 0) return emptyBoard;

  const fillRatio = safeFilled / Math.max(1, cellCount);
  const hardTier = rows >= 7 || fillRatio >= 0.58;
  const midTier = rows >= 6 || fillRatio >= 0.5;
  const targetMinMoves = hardTier ? 0 : 1;
  const targetMaxMoves = hardTier ? 1 : midTier ? 2 : 3;
  const maxEasyMoves = hardTier ? 0 : midTier ? 1 : 2;

  let bestBoard = [...emptyBoard];
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 36; attempt += 1) {
    const board: Array<number | null> = [...emptyBoard];

    // Pack random values at positions 0..safeFilled-1 (top of board).
    for (let i = 0; i < safeFilled; i += 1) {
      board[i] = randomInt(1, 9, rng);
    }

    // Anti-orphan repair: ensure every value present has at least one potential partner.
    const counts = buildValueCounts(board.slice(0, safeFilled));
    for (let guard = 0; guard < safeFilled * 4; guard += 1) {
      const orphans = getOrphanValues(counts);
      if (orphans.length === 0) break;
      const victim = orphans[0];
      const fix = complementFor(victim);
      let replaceIdx = -1;
      for (let i = 0; i < safeFilled; i += 1) {
        const v = board[i];
        if (typeof v === 'number' && v !== victim && getPairSupport(v, counts) > 2) {
          replaceIdx = i;
          break;
        }
      }
      if (replaceIdx < 0) {
        for (let i = 0; i < safeFilled; i += 1) {
          const v = board[i];
          if (typeof v === 'number' && v !== fix) {
            replaceIdx = i;
            break;
          }
        }
      }
      if (replaceIdx < 0) break;
      const prev = board[replaceIdx] as number;
      counts[prev] = Math.max(0, counts[prev] - 1);
      board[replaceIdx] = fix;
      counts[fix] += 1;
    }

    // Shuffle only inside each row to preserve top-packed layout.
    for (let row = 0; row * cols < safeFilled; row += 1) {
      const rowStart = row * cols;
      const rowEnd = Math.min(rowStart + cols, safeFilled);
      for (let i = rowEnd - 1; i > rowStart; i -= 1) {
        const j = rowStart + Math.floor(rng() * (i - rowStart + 1));
        const temp = board[i];
        board[i] = board[j];
        board[j] = temp;
      }
    }

    const moves = countValidMoves(board, cols);
    const belowMin = Math.max(0, targetMinMoves - moves);
    const aboveMax = Math.max(0, moves - targetMaxMoves);
    const easyMoves = countEasyOpeningMoves(board, cols);
    const easyMovePenalty = Math.max(0, easyMoves - maxEasyMoves);
    const score = belowMin * 4 + aboveMax * 3 + easyMovePenalty * 2;

    if (score < bestScore) {
      bestScore = score;
      bestBoard = board;
    }
    if (score === 0) return board;
  }

  return bestBoard;
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

function getPairSupport(value: number, counts: number[]): number {
  if (value === 5) return counts[5];
  return counts[value] + counts[10 - value];
}

function getOrphanValues(counts: number[]): number[] {
  const orphans: number[] = [];
  for (let value = 1; value <= 9; value += 1) {
    if (counts[value] <= 0) continue;
    if (getPairSupport(value, counts) < 2) {
      orphans.push(value);
    }
  }
  return orphans;
}

function complementFor(value: number): number {
  return value === 5 ? 5 : 10 - value;
}

function rankValuesForChallenge(counts: number[]): number[] {
  const present = Array.from({ length: 9 }, (_, index) => index + 1).filter((value) => counts[value] > 0);
  if (present.length === 0) {
    return [1, 9, 2, 8, 3, 7, 4, 6, 5];
  }

  // Prioritize scarce/at-risk values first to keep board solvable but still tense.
  return present.sort((a, b) => getPairSupport(a, counts) - getPairSupport(b, counts));
}

function countValidMoves(board: Array<number | null>, cols: number): number {
  const nonEmpty = board
    .map((value, index) => ({ value, index }))
    .filter((entry): entry is { value: number; index: number } => entry.value !== null);

  let matches = 0;
  for (let i = 0; i < nonEmpty.length; i += 1) {
    for (let j = i + 1; j < nonEmpty.length; j += 1) {
      const a = nonEmpty[i];
      const b = nonEmpty[j];
      if (!canValuesMatch(a.value, b.value)) continue;
      if (isValidMatchConnection(board, a.index, b.index, cols)) matches += 1;
    }
  }

  return matches;
}

function countEasyOpeningMoves(board: Array<number | null>, cols: number): number {
  const nonEmpty = board
    .map((value, index) => ({ value, index }))
    .filter((entry): entry is { value: number; index: number } => entry.value !== null);

  let easyMatches = 0;
  for (let i = 0; i < nonEmpty.length; i += 1) {
    for (let j = i + 1; j < nonEmpty.length; j += 1) {
      const a = nonEmpty[i];
      const b = nonEmpty[j];
      if (!canValuesMatch(a.value, b.value)) continue;
      if (!isValidMatchConnection(board, a.index, b.index, cols)) continue;

      const aRc = indexToRC(a.index, cols);
      const bRc = indexToRC(b.index, cols);
      const rowDist = Math.abs(aRc.row - bRc.row);
      const colDist = Math.abs(aRc.col - bRc.col);

      const obviousAdjacent = areAdjacent(a.index, b.index, cols) || areDiagonalAdjacent(a.index, b.index, cols);
      const shortOpenLine =
        (aRc.row === bRc.row && colDist <= 2 && noNumbersBetweenInRow(board, a.index, b.index, cols)) ||
        (aRc.col === bRc.col && rowDist <= 2 && noNumbersBetweenInCol(board, a.index, b.index, cols));

      if (obviousAdjacent || shortOpenLine) {
        easyMatches += 1;
      }
    }
  }

  return easyMatches;
}

function buildChallengingLineValues(board: Array<number | null>, count: number): number[] {
  if (count <= 0) return [];

  const counts = buildValueCounts(board);
  const line: number[] = [];
  const occupied = board.filter((value): value is number => value !== null).length;
  const denseBoard = occupied / Math.max(1, board.length) >= 0.45;
  const complementEvery = denseBoard ? 6 : 5;

  while (line.length < count) {
    const orphans = getOrphanValues(counts);
    if (orphans.length > 0) {
      const candidate = complementFor(orphans[0]);
      line.push(candidate);
      counts[candidate] += 1;
      continue;
    }

    const ranked = rankValuesForChallenge(counts);
    const pivot = ranked[line.length % ranked.length];
    // Harder cadence: complements appear less often than before.
    const candidate = line.length % complementEvery === 0 ? complementFor(pivot) : pivot;
    line.push(candidate);
    counts[candidate] += 1;
  }

  // Repair pass: no value present in board+line can remain orphaned.
  for (let guard = 0; guard < count * 4; guard += 1) {
    const orphans = getOrphanValues(counts);
    if (orphans.length === 0) break;

    const missing = orphans[0];
    const replacement = complementFor(missing);
    const replaceIndex = line.findIndex((value) => getPairSupport(value, counts) > 2);
    const indexToUse = replaceIndex >= 0 ? replaceIndex : line.length - 1;

    const prev = line[indexToUse];
    counts[prev] = Math.max(0, counts[prev] - 1);
    line[indexToUse] = replacement;
    counts[replacement] += 1;
  }

  return line;
}

function hasNoOrphanValues(board: Array<number | null>): boolean {
  return getOrphanValues(buildValueCounts(board)).length === 0;
}

function fillBoardAtIndices(
  board: Array<number | null>,
  targetIndices: number[],
  values: number[],
): Array<number | null> {
  const next = [...board];
  for (let i = 0; i < targetIndices.length; i += 1) {
    next[targetIndices[i]] = values[i];
  }
  return next;
}

function pickInsertionIndicesBelow(
  board: Array<number | null>,
  cols: number,
  toAdd: number,
): number[] {
  let lastOccupiedRow = -1;
  board.forEach((value, index) => {
    if (value !== null) {
      const row = Math.floor(index / cols);
      if (row > lastOccupiedRow) lastOccupiedRow = row;
    }
  });

  const targetFirstRow = lastOccupiedRow + 1;
  const belowEmpty: number[] = [];
  const otherEmpty: number[] = [];

  board.forEach((value, index) => {
    if (value === null) {
      const row = Math.floor(index / cols);
      if (row >= targetFirstRow) {
        belowEmpty.push(index);
      } else {
        otherEmpty.push(index);
      }
    }
  });

  return [...belowEmpty, ...otherEmpty].slice(0, toAdd);
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

export function compactBoard(board: Array<number | null>, cols: number): Array<number | null> {
  const rowCount = Math.floor(board.length / cols);
  const compacted: Array<number | null> = Array.from({ length: board.length }).map(() => null);
  let writeRow = 0;

  for (let row = 0; row < rowCount; row += 1) {
    const rowStart = row * cols;
    const hasNumber = board.slice(rowStart, rowStart + cols).some((v) => v !== null);
    if (hasNumber) {
      for (let col = 0; col < cols; col += 1) {
        compacted[writeRow * cols + col] = board[rowStart + col];
      }
      writeRow += 1;
    }
  }

  return compacted;
}

export function addLineFromRemaining(
  board: Array<number | null>,
  addLineCount?: number,
  cols?: number,
): { nextBoard: Array<number | null>; added: number } {
  // toAdd = numero de celdas actualmente ocupadas (mecanica de castigo/recompensa).
  const occupiedCount = board.filter((value): value is number => value !== null).length;
  if (occupiedCount === 0) {
    return { nextBoard: board, added: 0 };
  }

  const emptyIndices = board
    .map((value, index) => ({ value, index }))
    .filter((entry) => entry.value === null)
    .map((entry) => entry.index);

  const lineCap = typeof addLineCount === 'number' ? Math.max(1, Math.floor(addLineCount)) : occupiedCount;
  const toAdd = Math.min(occupiedCount, lineCap, emptyIndices.length);
  if (toAdd <= 0) {
    return { nextBoard: board, added: 0 };
  }

  // Insercion siempre debajo del ultimo bloque ocupado, de izquierda a derecha.
  const selectedIndices =
    typeof cols === 'number'
      ? pickInsertionIndicesBelow(board, cols, toAdd)
      : emptyIndices.slice(0, toAdd);

  const values = buildChallengingLineValues(board, toAdd);
  const candidate = fillBoardAtIndices([...board], selectedIndices, values);

  const playableEnough = typeof cols !== 'number' || hasAnyValidMove(candidate, cols);
  if (playableEnough && hasNoOrphanValues(candidate)) {
    return { nextBoard: candidate, added: toAdd };
  }

  // Fallback: forzar al menos un par conectable si el tablero perdio jugabilidad.
  if (typeof cols === 'number' && toAdd >= 2 && !hasAnyValidMove(candidate, cols)) {
    const pair = findConnectableEmptyPair([...board], selectedIndices, cols);
    if (pair) {
      const fallback = [...candidate];
      const pairValue = board.find((v): v is number => v !== null) ?? 1;
      fallback[pair[0]] = pairValue;
      fallback[pair[1]] = pairValue;
      return { nextBoard: fallback, added: toAdd };
    }
  }

  return { nextBoard: candidate, added: toAdd };
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
  boardEmpty?: boolean;
}): boolean {
  if (input.boardEmpty) return true;

  const efficientEnough = input.validMatches >= 6;
  const clearedEnough = input.boardClearedPercent >= 88;
  const weightedAttempts = input.validMatches + input.invalidMatches * 0.5 + 1;
  const execution = (input.validMatches / weightedAttempts) * 100;
  return clearedEnough && efficientEnough && execution >= 50;
}
