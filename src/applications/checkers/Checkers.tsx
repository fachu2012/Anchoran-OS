import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./checkers.css";

type Piece = { color: "B" | "W"; king: boolean } | null;
type Board = Piece[][];

function initialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array<Piece>(8).fill(null));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) board[r][c] = { color: "B", king: false };
    }
  }
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) board[r][c] = { color: "W", king: false };
    }
  }
  return board;
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function movesFor(board: Board, r: number, c: number): { to: [number, number]; capture?: [number, number] }[] {
  const piece = board[r][c];
  if (!piece) return [];
  const dirs = piece.king
    ? [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]
    : piece.color === "W"
      ? [
          [-1, 1],
          [-1, -1],
        ]
      : [
          [1, 1],
          [1, -1],
        ];
  const result: { to: [number, number]; capture?: [number, number] }[] = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc) && !board[nr][nc]) {
      result.push({ to: [nr, nc] });
    } else if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc]!.color !== piece.color) {
      const jr = r + dr * 2;
      const jc = c + dc * 2;
      if (inBounds(jr, jc) && !board[jr][jc]) {
        result.push({ to: [jr, jc], capture: [nr, nc] });
      }
    }
  }
  return result;
}

export function CheckersApp() {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [turn, setTurn] = useState<"W" | "B">("W");
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [captures, setCaptures] = useState({ W: 0, B: 0 });

  const legalMoves = useMemo(() => (selected ? movesFor(board, selected[0], selected[1]) : []), [board, selected]);

  const remaining = useMemo(() => {
    let w = 0;
    let b = 0;
    board.forEach((row) => row.forEach((cell) => {
      if (cell?.color === "W") w++;
      if (cell?.color === "B") b++;
    }));
    return { W: w, B: b };
  }, [board]);

  const winner = remaining.W === 0 ? "B" : remaining.B === 0 ? "W" : null;

  function onCellClick(r: number, c: number) {
    if (winner) return;
    const piece = board[r][c];
    if (selected) {
      const move = legalMoves.find((m) => m.to[0] === r && m.to[1] === c);
      if (move) {
        const next = board.map((row) => [...row]);
        const moving = next[selected[0]][selected[1]];
        next[selected[0]][selected[1]] = null;
        if (moving && (r === 0 || r === 7)) moving.king = true;
        next[r][c] = moving;
        if (move.capture) {
          next[move.capture[0]][move.capture[1]] = null;
          setCaptures((s) => ({ ...s, [turn]: s[turn] + 1 }));
        }
        setBoard(next);
        setSelected(null);
        setTurn((t) => (t === "W" ? "B" : "W"));
        return;
      }
      setSelected(piece && piece.color === turn ? [r, c] : null);
      return;
    }
    if (piece && piece.color === turn) setSelected([r, c]);
  }

  function reset() {
    setBoard(initialBoard());
    setTurn("W");
    setSelected(null);
    setCaptures({ W: 0, B: 0 });
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={reset}>
          <Icon name="restart" size={14} /> New game
        </button>
        <div className="checkers-status">
          {winner ? `${winner === "W" ? "White" : "Black"} wins!` : `Turn: ${turn === "W" ? "White" : "Black"}`}
        </div>
      </div>
      <div className="app-content checkers-content">
        <div className="checkers-board">
          {board.map((row, r) =>
            row.map((cell, c) => {
              const dark = (r + c) % 2 === 1;
              const isSelected = selected?.[0] === r && selected?.[1] === c;
              const isTarget = legalMoves.some((m) => m.to[0] === r && m.to[1] === c);
              return (
                <button
                  key={`${r}-${c}`}
                  className="checkers-cell"
                  data-dark={dark}
                  data-selected={isSelected}
                  data-target={isTarget}
                  onClick={() => dark && onCellClick(r, c)}
                >
                  {cell && <span className="checkers-piece" data-color={cell.color} data-king={cell.king} />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
