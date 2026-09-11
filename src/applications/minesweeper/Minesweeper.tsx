import { useCallback, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./minesweeper.css";

const ROWS = 10;
const COLS = 10;
const MINES = 14;

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
}

function buildBoard(safeR: number, safeC: number): Cell[][] {
  const board: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
  );
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (board[r][c].mine || (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)) continue;
    board[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].mine) count++;
        }
      }
      board[r][c].adjacent = count;
    }
  }
  return board;
}

export function MinesweeperApp() {
  const [board, setBoard] = useState<Cell[][] | null>(null);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [flagsUsed, setFlagsUsed] = useState(0);

  const reveal = useCallback((startBoard: Cell[][], r: number, c: number) => {
    const stack: [number, number][] = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      const cell = startBoard[cr][cc];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      if (cell.adjacent === 0 && !cell.mine) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !startBoard[nr][nc].revealed) {
              stack.push([nr, nc]);
            }
          }
        }
      }
    }
  }, []);

  function checkWin(b: Cell[][]) {
    return b.every((row) => row.every((cell) => cell.mine || cell.revealed));
  }

  function onCellClick(r: number, c: number) {
    if (status !== "playing") return;
    let current = board;
    if (!current) {
      current = buildBoard(r, c);
    } else {
      current = current.map((row) => row.map((cell) => ({ ...cell })));
    }
    const cell = current[r][c];
    if (cell.flagged || cell.revealed) {
      setBoard(current);
      return;
    }
    if (cell.mine) {
      current.forEach((row) => row.forEach((cc) => cc.mine && (cc.revealed = true)));
      setBoard(current);
      setStatus("lost");
      return;
    }
    reveal(current, r, c);
    setBoard(current);
    if (checkWin(current)) setStatus("won");
  }

  function onCellRightClick(e: React.MouseEvent, r: number, c: number) {
    e.preventDefault();
    if (status !== "playing" || !board) return;
    const cell = board[r][c];
    if (cell.revealed) return;
    const next = board.map((row) => row.map((cc) => ({ ...cc })));
    next[r][c].flagged = !next[r][c].flagged;
    setBoard(next);
    setFlagsUsed((f) => f + (next[r][c].flagged ? 1 : -1));
  }

  function reset() {
    setBoard(null);
    setStatus("playing");
    setFlagsUsed(0);
  }

  const displayBoard = board ?? buildBoard(-1, -1);

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={reset}>
          <Icon name="restart" size={14} /> New game
        </button>
        <div className="mine-status">
          {status === "won" ? "You win!" : status === "lost" ? "Boom — game over" : `Flags: ${flagsUsed}/${MINES}`}
        </div>
      </div>
      <div className="app-content mine-content">
        <div className="mine-board">
          {displayBoard.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                className="mine-cell"
                data-revealed={cell.revealed}
                data-mine={cell.revealed && cell.mine}
                onClick={() => onCellClick(r, c)}
                onContextMenu={(e) => onCellRightClick(e, r, c)}
              >
                {cell.revealed
                  ? cell.mine
                    ? "*"
                    : cell.adjacent || ""
                  : cell.flagged
                    ? <Icon name="pin" size={12} />
                    : ""}
              </button>
            ))
          )}
        </div>
        <div className="mine-hint">Right-click to flag a cell</div>
      </div>
    </div>
  );
}
