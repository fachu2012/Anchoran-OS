import { useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./diceroller.css";

interface Roll {
  id: number;
  values: number[];
  total: number;
}

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function DiceRollerApp() {
  const [count, setCount] = useState(2);
  const [current, setCurrent] = useState<number[]>([1, 1]);
  const [history, setHistory] = useState<Roll[]>([]);
  const [rolling, setRolling] = useState(false);

  function roll() {
    if (rolling) return;
    setRolling(true);
    let frames = 0;
    const interval = window.setInterval(() => {
      const values = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6));
      setCurrent(values);
      frames++;
      if (frames >= 8) {
        window.clearInterval(interval);
        setRolling(false);
        setHistory((h) => [{ id: Date.now(), values, total: values.reduce((a, b) => a + b, 0) }, ...h].slice(0, 20));
      }
    }, 60);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <label className="dice-count-label">
          Dice
          <input
            type="number"
            min={1}
            max={6}
            value={count}
            onChange={(e) => setCurrent((c) => {
              const n = Math.max(1, Math.min(6, Number(e.target.value) || 1));
              setCount(n);
              return Array.from({ length: n }, (_, i) => c[i] ?? 1);
            })}
          />
        </label>
        <button className="app-toolbar-btn" onClick={roll} disabled={rolling}>
          <Icon name="diceRoller" size={14} /> Roll
        </button>
      </div>
      <div className="app-content dice-content">
        <div className="dice-row">
          {current.map((v, i) => (
            <div key={i} className="dice-face" data-rolling={rolling}>
              {DICE_FACES[v - 1]}
            </div>
          ))}
        </div>
        <div className="dice-total">Total: {current.reduce((a, b) => a + b, 0)}</div>
        {history.length > 0 && (
          <div className="dice-history">
            {history.map((r) => (
              <div key={r.id} className="dice-history-row">
                <span>{r.values.join(" + ")}</span>
                <span className="dice-history-total">{r.total}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
