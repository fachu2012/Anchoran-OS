import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./sudoku.css";
import { generatePuzzle, type Difficulty, type Grid } from "./sudokuLogic";

export function SudokuApp() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [game, setGame] = useState(() => generatePuzzle("easy"));
  const [grid, setGrid] = useState<Grid>(() => game.puzzle.map((r) => [...r]));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [checkResult, setCheckResult] = useState<"correct" | "incorrect" | null>(null);

  const fixedCells = useMemo(
    () => new Set(game.puzzle.flatMap((row, r) => row.map((v, c) => (v !== 0 ? `${r}-${c}` : null)))),
    [game]
  );

  function newGame(diff: Difficulty) {
    const g = generatePuzzle(diff);
    setDifficulty(diff);
    setGame(g);
    setGrid(g.puzzle.map((r) => [...r]));
    setSelected(null);
    setCheckResult(null);
  }

  function setValue(val: number) {
    if (!selected) return;
    const [r, c] = selected;
    if (fixedCells.has(`${r}-${c}`)) return;
    const next = grid.map((row) => [...row]);
    next[r][c] = val;
    setGrid(next);
    setCheckResult(null);
  }

  function check() {
    const solved = grid.every((row, r) => row.every((v, c) => v === game.solution[r][c]));
    setCheckResult(solved ? "correct" : "incorrect");
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
          <button key={d} className="app-toolbar-btn" data-op={difficulty === d} onClick={() => newGame(d)}>
            {d[0].toUpperCase() + d.slice(1)}
          </button>
        ))}
        <button className="app-toolbar-btn" onClick={check}>
          <Icon name="check" size={14} /> Check
        </button>
      </div>
      <div className="app-content sudoku-content">
        <div className="sudoku-board">
          {grid.map((row, r) =>
            row.map((v, c) => {
              const fixed = fixedCells.has(`${r}-${c}`);
              return (
                <button
                  key={`${r}-${c}`}
                  className="sudoku-cell"
                  data-fixed={fixed}
                  data-selected={selected?.[0] === r && selected?.[1] === c}
                  data-border-right={c % 3 === 2 && c !== 8}
                  data-border-bottom={r % 3 === 2 && r !== 8}
                  onClick={() => !fixed && setSelected([r, c])}
                >
                  {v !== 0 ? v : ""}
                </button>
              );
            })
          )}
        </div>
        <div className="sudoku-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} className="sudoku-pad-btn" onClick={() => setValue(n)}>
              {n}
            </button>
          ))}
          <button className="sudoku-pad-btn" onClick={() => setValue(0)}>
            <Icon name="close" size={13} />
          </button>
        </div>
        {checkResult && (
          <div className="sudoku-result" data-correct={checkResult === "correct"}>
            {checkResult === "correct" ? "Solved correctly!" : "Not quite — keep trying"}
          </div>
        )}
      </div>
    </div>
  );
}
