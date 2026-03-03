export function solveSudoku(input: number[]): number[] | null {
  const board = [...input];

  function isValid(index: number, value: number): boolean {
    const row = Math.floor(index / 9);
    const col = index % 9;

    for (let i = 0; i < 9; i += 1) {
      if (board[row * 9 + i] === value) return false;
      if (board[i * 9 + col] === value) return false;
    }

    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;

    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        if (board[(boxRow + r) * 9 + (boxCol + c)] === value) return false;
      }
    }

    return true;
  }

  function backtrack(): boolean {
    const empty = board.findIndex((value) => value === 0);
    if (empty === -1) return true;

    for (let value = 1; value <= 9; value += 1) {
      if (isValid(empty, value)) {
        board[empty] = value;
        if (backtrack()) return true;
        board[empty] = 0;
      }
    }

    return false;
  }

  return backtrack() ? board : null;
}