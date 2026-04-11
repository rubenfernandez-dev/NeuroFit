import { describe, expect, it } from 'vitest';
import {
  addLineFromRemaining,
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

    const { nextBoard, added } = addLineFromRemaining(board, 3, 4);

    expect(added).toBe(3);
    expect(nextBoard.filter((v) => v !== null).length).toBe(5);
    expect(hasAnyValidMove(nextBoard, 4)).toBe(true);
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
      evaluateNumberMatchWin({ boardClearedPercent: 85, validMatches: 7, invalidMatches: 4 }),
    ).toBe(true);

    expect(
      evaluateNumberMatchWin({ boardClearedPercent: 90, validMatches: 4, invalidMatches: 0 }),
    ).toBe(false);
  });
});
