import { STORAGE_KEYS } from '../../../shared/storage/keys';
import { SudokuPersistedState, SudokuState } from '../model/types';
import { normalizeDifficulty } from '../../types';
import { deleteItem, getItem, setItem } from '../../../shared/storage/secureStore';

function toRows(flat: number[]): number[][] {
  return Array.from({ length: 9 }, (_, row) => flat.slice(row * 9, row * 9 + 9));
}

function normalizeNoteCell(notes: unknown): number[] {
  if (!Array.isArray(notes)) return [];
  return notes
    .filter((value): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 9)
    .filter((value, index, source) => source.indexOf(value) === index)
    .sort((a, b) => a - b);
}

function emptyNotes(): number[][][] {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as number[]));
}

function createStateFromPuzzle(puzzle: number[]): SudokuState {
  const grid = toRows(puzzle);
  const givens = grid.map((row) => row.map((value) => value !== 0));
  return {
    grid,
    givens,
    notes: emptyNotes(),
    noteMode: false,
    history: [],
    mistakes: 0,
    gameOver: false,
    lastErrorCell: null,
    didWin: false,
    sessionStarted: false,
  };
}

function normalizePersistedState(parsed: unknown): SudokuPersistedState | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const state = parsed as Partial<SudokuPersistedState> & {
    grid?: number[] | number[][];
  };

  if (!Array.isArray(state.puzzle) || !Array.isArray(state.solution)) return null;

  const base = createStateFromPuzzle(state.puzzle as number[]);

  const gridRows = Array.isArray(state.grid)
    ? Array.isArray(state.grid[0])
      ? (state.grid as number[][])
      : toRows(state.grid as number[])
    : base.grid;

  const givensRows =
    Array.isArray(state.givens) && state.givens.length === 9
      ? state.givens.map((row, rowIndex) =>
          Array.isArray(row) && row.length === 9
            ? row.map((value, colIndex) => (typeof value === 'boolean' ? value : base.givens[rowIndex][colIndex]))
            : base.givens[rowIndex],
        )
      : base.givens;

  const notesRows =
    Array.isArray(state.notes) && state.notes.length === 9
      ? state.notes.map((row) =>
          Array.isArray(row) && row.length === 9 ? row.map((cell) => normalizeNoteCell(cell)) : Array.from({ length: 9 }, () => [] as number[]),
        )
      : base.notes;

  const history = Array.isArray(state.history)
    ? state.history.filter(
        (entry): entry is SudokuPersistedState['history'][number] =>
          !!entry &&
          typeof entry.row === 'number' &&
          typeof entry.col === 'number' &&
          typeof entry.prevValue === 'number' &&
          typeof entry.nextValue === 'number' &&
          Array.isArray(entry.prevNotes),
      )
    : [];

  const rawErrorCell =
    state.lastErrorCell &&
    typeof state.lastErrorCell.row === 'number' &&
    typeof state.lastErrorCell.col === 'number' &&
    state.lastErrorCell.row >= 0 &&
    state.lastErrorCell.row <= 8 &&
    state.lastErrorCell.col >= 0 &&
    state.lastErrorCell.col <= 8
      ? { row: state.lastErrorCell.row, col: state.lastErrorCell.col }
      : null;

  const mistakes = typeof state.mistakes === 'number' ? Math.max(0, Math.min(5, Math.floor(state.mistakes))) : 0;
  const gameOver = Boolean(state.gameOver) || mistakes >= 5;

  return {
    puzzle: state.puzzle as number[],
    solution: state.solution as number[],
    difficulty: normalizeDifficulty(state.difficulty, 'avanzado'),
    elapsedMs: typeof state.elapsedMs === 'number' ? state.elapsedMs : 0,
    isDaily: state.isDaily,
    dailyDateISO: state.dailyDateISO,
    grid: gridRows.map((row, rowIndex) =>
      Array.from({ length: 9 }, (_, colIndex) => {
        const value = row?.[colIndex];
        return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9 ? value : base.grid[rowIndex][colIndex];
      }),
    ),
    givens: givensRows,
    notes: notesRows,
    noteMode: Boolean(state.noteMode),
    history: history.map((entry) => ({
      ...entry,
      prevNotes: normalizeNoteCell(entry.prevNotes),
      mistakesDelta: typeof entry.mistakesDelta === 'number' ? Math.max(0, Math.floor(entry.mistakesDelta)) : 0,
      prevGameOver: Boolean(entry.prevGameOver),
      prevErrorCell:
        entry.prevErrorCell && typeof entry.prevErrorCell.row === 'number' && typeof entry.prevErrorCell.col === 'number'
          ? { row: entry.prevErrorCell.row, col: entry.prevErrorCell.col }
          : null,
    })),
    mistakes,
    gameOver,
    lastErrorCell: rawErrorCell,
    didWin: Boolean(state.didWin),
    sessionStarted: Boolean(state.sessionStarted),
  };
}

export function createInitialSudokuState(puzzle: number[]): SudokuState {
  return createStateFromPuzzle(puzzle);
}

export async function getSudokuState(): Promise<SudokuPersistedState | null> {
  const raw = await getItem(STORAGE_KEYS.sudokuState);
  if (!raw) return null;
  try {
    return normalizePersistedState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveSudokuState(state: SudokuPersistedState) {
  await setItem(STORAGE_KEYS.sudokuState, JSON.stringify(state));
}

export async function clearSudokuState() {
  await deleteItem(STORAGE_KEYS.sudokuState);
}