import { useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./tictactoe.css";

type Cell = "X" | "O" | null;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winnerOf(board: Cell[]): { winner: Cell; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return null;
}

export function TicTacToeApp() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });

  const result = winnerOf(board);
  const isDraw = !result && board.every((c) => c !== null);

  function play(i: number) {
    if (board[i] || result || isDraw) return;
    const next = [...board];
    next[i] = turn;
    setBoard(next);
    const w = winnerOf(next);
    if (w) {
      setScores((s) => ({ ...s, [w.winner as "X" | "O"]: s[w.winner as "X" | "O"] + 1 }));
    } else if (next.every((c) => c !== null)) {
      setScores((s) => ({ ...s, draws: s.draws + 1 }));
    }
    setTurn((t) => (t === "X" ? "O" : "X"));
  }

  function reset() {
    setBoard(Array(9).fill(null));
    setTurn("X");
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={reset}>
          <Icon name="restart" size={14} /> New round
        </button>
        <div className="ttt-scores">
          X {scores.X} · O {scores.O} · Draws {scores.draws}
        </div>
      </div>
      <div className="app-content ttt-content">
        <div className="ttt-status">
          {result ? `${result.winner} wins!` : isDraw ? "It's a draw" : `Turn: ${turn}`}
        </div>
        <div className="ttt-board">
          {board.map((cell, i) => (
            <button
              key={i}
              className="ttt-cell"
              data-mark={cell || undefined}
              data-win={result?.line.includes(i) || undefined}
              onClick={() => play(i)}
            >
              {cell}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
