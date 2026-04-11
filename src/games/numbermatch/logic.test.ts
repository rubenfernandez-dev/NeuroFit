import { describe, expect, it } from 'vitest';
import { hasAnyValidMove, isValidMatchConnection } from './logic';

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
});
