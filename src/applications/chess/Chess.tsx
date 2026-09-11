import { useState } from "react";
import { Icon } from "@/components/Icon";
import {
  initialBoard,
  legalMoves,
  makeMove,
  isInCheck,
  hasAnyLegalMove,
  PIECE_UNICODE,
  type Board,
  type Color,
} from "./chessLogic";
import "@/applications/apps.css";
import "./chess.css";

export function ChessApp() {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [turn, setTurn] = useState<Color>("w");
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [captured, setCaptured] = useState<{ w: string[]; b: string[] }>({ w: [], b: [] });

  const inCheck = isInCheck(board, turn);
  const hasMoves = hasAnyLegalMove(board, turn);
  const gameOver = !hasMoves;
  const moves = selected ? legalMoves(board, selected[0], selected[1]) : [];

  function reset() {
    setBoard(initialBoard());
    setTurn("w");
    setSelected(null);
    setCaptured({ w: [], b: [] });
  }

  function onSquareClick(r: number, c: number) {
    if (gameOver) return;
    const piece = board[r][c];
    if (selected) {
      const isLegal = moves.some(([mr, mc]) => mr === r && mc === c);
      if (isLegal) {
        const target = board[r][c];
        if (target) setCaptured((cap) => ({ ...cap, [turn]: [...cap[turn], PIECE_UNICODE[target.color][target.type]] }));
        setBoard(makeMove(board, selected, [r, c]));
        setSelected(null);
        setTurn((t) => (t === "w" ? "b" : "w"));
        return;
      }
      setSelected(piece && piece.color === turn ? [r, c] : null);
      return;
    }
    if (piece && piece.color === turn) setSelected([r, c]);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={reset}>
          <Icon name="restart" size={14} /> New game
        </button>
        <span className="chess-status">
          {gameOver
            ? inCheck
              ? `Checkmate — ${turn === "w" ? "Black" : "White"} wins!`
              : "Stalemate — draw"
            : `${turn === "w" ? "White" : "Black"} to move${inCheck ? " (in check)" : ""}`}
        </span>
      </div>
      <div className="app-content chess-content">
        <div className="chess-board">
          {board.map((row, r) =>
            row.map((piece, c) => {
              const dark = (r + c) % 2 === 1;
              const isSelected = selected?.[0] === r && selected?.[1] === c;
              const isTarget = moves.some(([mr, mc]) => mr === r && mc === c);
              return (
                <button
                  key={`${r}-${c}`}
                  className="chess-square"
                  data-dark={dark}
                  data-selected={isSelected}
                  data-target={isTarget}
                  onClick={() => onSquareClick(r, c)}
                >
                  {piece && <span data-color={piece.color}>{PIECE_UNICODE[piece.color][piece.type]}</span>}
                </button>
              );
            })
          )}
        </div>
        <div className="chess-captured">
          <div>White captured: {captured.w.join(" ") || "—"}</div>
          <div>Black captured: {captured.b.join(" ") || "—"}</div>
        </div>
      </div>
    </div>
  );
}
