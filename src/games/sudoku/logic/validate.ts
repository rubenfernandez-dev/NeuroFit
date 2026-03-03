export function findConflicts(grid: number[]): Set<number> {
  const conflicts = new Set<number>();

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const index = row * 9 + col;
      const value = grid[index];
      if (!value) continue;

      for (let c = 0; c < 9; c += 1) {
        const other = row * 9 + c;
        if (other !== index && grid[other] === value) {
          conflicts.add(index);
          conflicts.add(other);
        }
      }

      for (let r = 0; r < 9; r += 1) {
        const other = r * 9 + col;
        if (other !== index && grid[other] === value) {
          conflicts.add(index);
          conflicts.add(other);
        }
      }

      const boxRow = Math.floor(row / 3) * 3;
      const boxCol = Math.floor(col / 3) * 3;
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
          const other = (boxRow + r) * 9 + (boxCol + c);
          if (other !== index && grid[other] === value) {
            conflicts.add(index);
            conflicts.add(other);
          }
        }
      }
    }
  }

  return conflicts;
}

export function isSolved(grid: number[], solution: number[]): boolean {
  if (grid.includes(0)) return false;
  return grid.every((value, index) => value === solution[index]);
}