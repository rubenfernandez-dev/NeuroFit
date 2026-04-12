import { describe, expect, it } from 'vitest';
import {
  addLineFromRemaining,
  compactBoard,
  computeRewardScoreNumberMatch,
  evaluateNumberMatchWin,
  hasAnyValidMove,
  isValidMatchConnection,
} from './logic';

describe('numbermatch connection rules', () => {
  it('permite diagonal cuando el camino esta libre', () => {
    const board = Array<number | null>(16).fill(null);
    board[0] = 1;
    board[10] = 1;
    expect(isValidMatchConnection(board, 0, 10, 4)).toBe(true);
  });

  it('bloquea diagonal si hay numero intermedio', () => {
    const board = Array<number | null>(16).fill(null);
    board[0] = 1;
    board[5] = 9;
    board[10] = 1;
    expect(isValidMatchConnection(board, 0, 10, 4)).toBe(false);
  });

  it('permite continuidad visual entre lineas cuando no hay bloqueos', () => {
    const board = Array<number | null>(12).fill(null);
    board[2] = 5;
    board[7] = 5;
    expect(isValidMatchConnection(board, 2, 7, 4)).toBe(true);
  });

  it('detecta movimientos validos con nuevas conexiones', () => {
    const board = Array<number | null>(16).fill(null);
    board[0] = 4;
    board[10] = 6;
    expect(hasAnyValidMove(board, 4)).toBe(true);
  });

  it('agrega linea coherente y mantiene el tablero jugable cuando es posible', () => {
    const board = Array<number | null>(16).fill(null);
    board[0] = 4;
    board[5] = 6;
    const { nextBoard, added } = addLineFromRemaining(board, 99, 4);
    expect(added).toBe(2);
    expect(nextBoard.filter((v) => v !== null).length).toBe(4);
    expect(hasAnyValidMove(nextBoard, 4)).toBe(true);
  });

  it('corrige numeros huerfanos existentes usando la linea nueva', () => {
    const board = Array<number | null>(25).fill(null);
    board[1] = 2;
    board[7] = 4;
    board[12] = 6;
    const { nextBoard } = addLineFromRemaining(board, 4, 5);
    const allNumbers = nextBoard.filter((value): value is number => value !== null);
    expect(allNumbers.includes(2)).toBe(true);
    expect(allNumbers.includes(8)).toBe(true);
    expect(hasAnyValidMove(nextBoard, 5)).toBe(true);
  });

  it('la linea no depende solo de sus propios valores y complementa el tablero previo', () => {
    const board = Array<number | null>(25).fill(null);
    board[0] = 1;
    board[6] = 3;
    board[18] = 7;
    const { nextBoard, added } = addLineFromRemaining(board, 5, 5);
    const newValues = nextBoard
      .map((value, index) => ({ value, index }))
      .filter((entry) => board[entry.index] === null && entry.value !== null)
      .map((entry) => entry.value as number);
    expect(added).toBe(3);
    expect(newValues.some((value) => value === 9 || value === 7 || value === 3)).toBe(true);
  });

  it('la cantidad añadida es exactamente igual al numero de celdas ocupadas', () => {
    const cols = 5;
    const board = Array<number | null>(25).fill(null);
    board[0] = 3;
    board[4] = 7;
    board[11] = 1;
    board[14] = 4;
    const { added } = addLineFromRemaining(board, 99, cols);
    expect(added).toBe(4);
  });

  it('los numeros nuevos se insertan debajo de la ultima fila ocupada', () => {
    const cols = 5;
    const board = Array<number | null>(25).fill(null);
    board[0] = 2;
    board[1] = 8;
    board[5] = 3;
    board[6] = 7;
    const { nextBoard } = addLineFromRemaining(board, 99, cols);
    const newIndices = nextBoard
      .map((value, index) => ({ value, index }))
      .filter((entry) => board[entry.index] === null && entry.value !== null)
      .map((entry) => entry.index);
    expect(newIndices.length).toBe(4);
    expect(newIndices.every((index) => Math.floor(index / cols) >= 2)).toBe(true);
  });
});

describe('numbermatch compactBoard', () => {
  it('elimina filas completamente vacias y sube el contenido', () => {
    const cols = 3;
    const board: Array<number | null> = [1, 2, 3, null, null, null, 4, 5, 6];
    const result = compactBoard(board, cols);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
    expect(result[2]).toBe(3);
    expect(result[3]).toBe(4);
    expect(result[4]).toBe(5);
    expect(result[5]).toBe(6);
    expect(result[6]).toBe(null);
    expect(result[7]).toBe(null);
    expect(result[8]).toBe(null);
  });

  it('no modifica un tablero ya compacto', () => {
    const cols = 3;
    const board: Array<number | null> = [1, 2, 3, 4, 5, 6, null, null, null];
    const result = compactBoard(board, cols);
    expect(result).toEqual(board);
  });
});

describe('numbermatch evaluation and reward', () => {
  it('premia mas una partida eficiente y con menos lineas usadas', () => {
    const efficient = computeRewardScoreNumberMatch({
      score: 170,
      validMatches: 12,
      invalidMatches: 2,
      bestCombo: 5,
      boardClearedPercent: 88,
      linesUsed: 2,
    });
    const inefficient = computeRewardScoreNumberMatch({
      score: 170,
      validMatches: 12,
      invalidMatches: 2,
      bestCombo: 5,
      boardClearedPercent: 88,
      linesUsed: 10,
    });
    expect(efficient).toBeGreaterThan(inefficient);
  });

  it('solo marca victoria cuando hay progreso y ejecucion suficiente', () => {
    expect(
      evaluateNumberMatchWin({ boardClearedPercent: 90, validMatches: 7, invalidMatches: 4 }),
    ).toBe(true);
    expect(
      evaluateNumberMatchWin({ boardClearedPercent: 90, validMatches: 4, invalidMatches: 0 }),
    ).toBe(false);
  });

  it('tablero vacio siempre cuenta como victoria', () => {
    expect(
      evaluateNumberMatchWin({
        boardClearedPercent: 100,
        validMatches: 0,
        invalidMatches: 20,
        boardEmpty: true,
      }),
    ).toBe(true);
  });
});
