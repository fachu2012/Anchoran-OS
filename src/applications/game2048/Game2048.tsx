import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./game2048.css";

const SIZE = 4;
type Board = number[][];

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addRandomTile(board: Board): Board {
  const empties: [number, number][] = [];
  board.forEach((row, y) => row.forEach((v, x) => v === 0 && empties.push([y, x])));
  if (empties.length === 0) return board;
  const [y, x] = empties[Math.floor(Math.random() * empties.length)];
  const next = board.map((row) => [...row]);
  next[y][x] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideRow(row: number[]): { row: number[]; gained: number; moved: boolean } {
  const filtered = row.filter((v) => v !== 0);
  let gained = 0;
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] === filtered[i + 1]) {
      filtered[i] *= 2;
      gained += filtered[i];
      filtered.splice(i + 1, 1);
    }
  }
  while (filtered.length < SIZE) filtered.push(0);
  const moved = filtered.some((v, i) => v !== row[i]);
  return { row: filtered, gained, moved };
}

function rotate(board: Board): Board {
  const next = emptyBoard();
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) next[x][SIZE - 1 - y] = board[y][x];
  return next;
}

function move(board: Board, dir: "left" | "right" | "up" | "down") {
  let working = board;
  let rotations = 0;
  if (dir === "up") rotations = 3;
  else if (dir === "right") rotations = 2;
  else if (dir === "down") rotations = 1;
  for (let i = 0; i < rotations; i++) working = rotate(working);

  let gained = 0;
  let moved = false;
  const resultRows = working.map((row) => {
    const isRight = dir === "right";
    const r = isRight ? [...row].reverse() : row;
    const { row: slid, gained: g, moved: m } = slideRow(r);
    gained += g;
    moved = moved || m;
    return isRight ? slid.reverse() : slid;
  });
  let result: Board = resultRows;
  for (let i = 0; i < (4 - rotations) % 4; i++) result = rotate(result);
  return { board: result, gained, moved };
}

function hasMoves(board: Board): boolean {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] === 0) return true;
      if (x < SIZE - 1 && board[y][x] === board[y][x + 1]) return true;
      if (y < SIZE - 1 && board[y][x] === board[y + 1][x]) return true;
    }
  }
  return false;
}

function initBoard(): Board {
  return addRandomTile(addRandomTile(emptyBoard()));
}

export function Game2048App() {
  const [board, setBoard] = useState<Board>(initBoard);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);

  const restart = useCallback(() => {
    setBoard(initBoard());
    setScore(0);
    setOver(false);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, "left" | "right" | "up" | "down"> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        a: "left",
        d: "right",
        w: "up",
        s: "down",
      };
      const dir = map[e.key];
      if (!dir || over) return;
      e.preventDefault();
      setBoard((prev) => {
        const { board: next, gained, moved } = move(prev, dir);
        if (!moved) return prev;
        setScore((sc) => {
          const ns = sc + gained;
          setBest((b) => Math.max(b, ns));
          return ns;
        });
        const withTile = addRandomTile(next);
        if (!hasMoves(withTile)) setOver(true);
        return withTile;
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [over]);

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={restart}>
          <Icon name="restart" size={14} /> New game
        </button>
        <div className="game2048-score">
          Score: {score} · Best: {best}
        </div>
      </div>
      <div className="app-content game2048-content">
        <div className="game2048-board">
          {board.flatMap((row, y) =>
            row.map((v, x) => (
              <div key={`${y}-${x}`} className="game2048-cell" data-value={v || undefined}>
                {v !== 0 && v}
              </div>
            ))
          )}
          {over && (
            <div className="game2048-overlay">
              <div>Game over</div>
            </div>
          )}
        </div>
        <div className="game2048-hint">Use the arrow keys to play</div>
      </div>
    </div>
  );
}
