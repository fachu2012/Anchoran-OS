export type Grid = number[][]; // 0 = empty

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isValid(grid: Grid, row: number, col: number, val: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (grid[row][i] === val || grid[i][col] === val) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (grid[r][c] === val) return false;
    }
  }
  return true;
}

function fillGrid(grid: Grid): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        for (const val of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
          if (isValid(grid, row, col, val)) {
            grid[row][col] = val;
            if (fillGrid(grid)) return true;
            grid[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

export type Difficulty = "easy" | "medium" | "hard";

const HOLES: Record<Difficulty, number> = { easy: 36, medium: 46, hard: 54 };

export function generatePuzzle(difficulty: Difficulty): { puzzle: Grid; solution: Grid } {
  const solution: Grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillGrid(solution);
  const puzzle = solution.map((row) => [...row]);
  const cells = shuffled(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9] as [number, number])
  );
  let removed = 0;
  for (const [r, c] of cells) {
    if (removed >= HOLES[difficulty]) break;
    puzzle[r][c] = 0;
    removed++;
  }
  return { puzzle, solution };
}
