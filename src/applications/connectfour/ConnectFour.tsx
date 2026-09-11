import { useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./connectfour.css";

const ROWS = 6;
const COLS = 7;
type Cell = "R" | "Y" | null;

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

function checkWinner(board: Cell[][]): Cell {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      for (const [dr, dc] of dirs) {
        let count = 1;
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== cell) break;
          count++;
        }
        if (count >= 4) return cell;
      }
    }
  }
  return null;
}

export function ConnectFourApp() {
  const [board, setBoard] = useState<Cell[][]>(emptyBoard);
  const [turn, setTurn] = useState<"R" | "Y">("R");
  const [winner, setWinner] = useState<Cell>(null);
  const [scores, setScores] = useState({ R: 0, Y: 0 });

  const isFull = board.every((row) => row.every((c) => c !== null));

  function drop(col: number) {
    if (winner) return;
    const next = board.map((row) => [...row]);
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!next[r][col]) {
        next[r][col] = turn;
        setBoard(next);
        const w = checkWinner(next);
        if (w) {
          setWinner(w);
          setScores((s) => ({ ...s, [w]: s[w] + 1 }));
        } else {
          setTurn((t) => (t === "R" ? "Y" : "R"));
        }
        return;
      }
    }
  }

  function reset() {
    setBoard(emptyBoard());
    setTurn("R");
    setWinner(null);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={reset}>
          <Icon name="restart" size={14} /> New round
        </button>
        <div className="c4-scores">Red {scores.R} · Yellow {scores.Y}</div>
      </div>
      <div className="app-content c4-content">
        <div className="c4-status">
          {winner ? `${winner === "R" ? "Red" : "Yellow"} wins!` : isFull ? "It's a draw" : `Turn: ${turn === "R" ? "Red" : "Yellow"}`}
        </div>
        <div className="c4-board">
          {board.map((row, r) =>
            row.map((cell, c) => (
              <button key={`${r}-${c}`} className="c4-cell" onClick={() => drop(c)}>
                <span className="c4-disc" data-color={cell || undefined} />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
