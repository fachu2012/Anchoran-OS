import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./snake.css";

const GRID = 18;
const TICK_MS = 130;

type Point = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function randomFood(snake: Point[]): Point {
  let food: Point;
  do {
    food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
  return food;
}

export function SnakeApp() {
  const [snake, setSnake] = useState<Point[]>([{ x: 9, y: 9 }]);
  const [food, setFood] = useState<Point>(() => randomFood([{ x: 9, y: 9 }]));
  const [dir, setDir] = useState<Dir>("right");
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const dirRef = useRef(dir);
  const nextDirRef = useRef(dir);

  useEffect(() => {
    dirRef.current = dir;
  }, [dir]);

  const restart = useCallback(() => {
    const start = [{ x: 9, y: 9 }];
    setSnake(start);
    setFood(randomFood(start));
    setDir("right");
    nextDirRef.current = "right";
    setScore(0);
    setGameOver(false);
    setRunning(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, Dir> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      const next = map[e.key];
      if (!next) return;
      e.preventDefault();
      const opposite: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
      if (opposite[next] === dirRef.current) return;
      nextDirRef.current = next;
      if (!running && !gameOver) setRunning(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, gameOver]);

  useEffect(() => {
    if (!running || gameOver) return;
    const interval = window.setInterval(() => {
      setDir(nextDirRef.current);
      setSnake((prev) => {
        const delta = DELTA[nextDirRef.current];
        const head = { x: prev[0].x + delta.x, y: prev[0].y + delta.y };
        if (
          head.x < 0 ||
          head.y < 0 ||
          head.x >= GRID ||
          head.y >= GRID ||
          prev.some((s) => s.x === head.x && s.y === head.y)
        ) {
          setGameOver(true);
          setRunning(false);
          setBest((b) => Math.max(b, prev.length - 1));
          return prev;
        }
        const ate = head.x === food.x && head.y === food.y;
        const nextSnake = [head, ...prev];
        if (ate) {
          setScore((sc) => sc + 1);
          setFood(randomFood(nextSnake));
        } else {
          nextSnake.pop();
        }
        return nextSnake;
      });
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [running, gameOver, food]);

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={() => (gameOver ? restart() : setRunning((r) => !r))}>
          {gameOver ? "New game" : running ? "Pause" : "Start"}
        </button>
        <button className="app-toolbar-btn" onClick={restart}>
          <Icon name="restart" size={14} /> Reset
        </button>
        <div className="snake-score">
          Score: {score} · Best: {best}
        </div>
      </div>
      <div className="app-content snake-content">
        <div className="snake-board" style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }}>
          {Array.from({ length: GRID * GRID }).map((_, i) => {
            const x = i % GRID;
            const y = Math.floor(i / GRID);
            const isHead = snake[0].x === x && snake[0].y === y;
            const isBody = !isHead && snake.some((s) => s.x === x && s.y === y);
            const isFood = food.x === x && food.y === y;
            return (
              <div
                key={i}
                className="snake-cell"
                data-head={isHead}
                data-body={isBody}
                data-food={isFood}
              />
            );
          })}
          {gameOver && (
            <div className="snake-overlay">
              <div>Game over</div>
            </div>
          )}
          {!running && !gameOver && score === 0 && (
            <div className="snake-overlay">
              <div>Press an arrow key to start</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
