import { useState } from "react";
import "@/applications/apps.css";

const BUTTONS = [
  "C", "±", "%", "÷",
  "7", "8", "9", "×",
  "4", "5", "6", "−",
  "1", "2", "3", "+",
  "0", ".", "=",
];

export function CalculatorApp() {
  const [display, setDisplay] = useState("0");
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<string | null>(null);
  const [awaitingOperand, setAwaitingOperand] = useState(false);
  const [memory, setMemory] = useState<number | null>(null);
  const [history, setHistory] = useState<{ expression: string; result: string }[]>([]);

  function inputDigit(digit: string) {
    if (awaitingOperand) {
      setDisplay(digit === "." ? "0." : digit);
      setAwaitingOperand(false);
      return;
    }
    if (digit === "." && display.includes(".")) return;
    setDisplay(display === "0" && digit !== "." ? digit : display + digit);
  }

  function applyOp(a: number, b: number, op: string): number {
    switch (op) {
      case "+": return a + b;
      case "−": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default: return b;
    }
  }

  function onOperator(op: string) {
    const value = parseFloat(display);
    if (op === "C") {
      setDisplay("0");
      setAccumulator(null);
      setPendingOp(null);
      setAwaitingOperand(false);
      return;
    }
    if (op === "±") {
      setDisplay(String(value * -1));
      return;
    }
    if (op === "%") {
      setDisplay(String(value / 100));
      return;
    }
    if (op === "=") {
      if (pendingOp && accumulator !== null) {
        const result = applyOp(accumulator, value, pendingOp);
        const expression = `${accumulator} ${pendingOp} ${value}`;
        setDisplay(String(result));
        setHistory((h) => [{ expression, result: String(result) }, ...h].slice(0, 30));
        setAccumulator(null);
        setPendingOp(null);
        setAwaitingOperand(true);
      }
      return;
    }
    // + − × ÷
    if (pendingOp && accumulator !== null && !awaitingOperand) {
      const result = applyOp(accumulator, value, pendingOp);
      setAccumulator(result);
      setDisplay(String(result));
    } else {
      setAccumulator(value);
    }
    setPendingOp(op);
    setAwaitingOperand(true);
  }

  function memoryAction(action: "MC" | "MR" | "M+" | "M-") {
    const value = parseFloat(display);
    if (action === "MC") setMemory(null);
    else if (action === "MR") {
      if (memory !== null) {
        setDisplay(String(memory));
        setAwaitingOperand(false);
      }
    } else if (action === "M+") setMemory((m) => (m ?? 0) + value);
    else if (action === "M-") setMemory((m) => (m ?? 0) - value);
  }

  return (
    <div className="calc-root">
      <div className="calc-memory-row">
        <button className="calc-mem-btn" onClick={() => memoryAction("MC")} disabled={memory === null}>
          MC
        </button>
        <button className="calc-mem-btn" onClick={() => memoryAction("MR")} disabled={memory === null}>
          MR
        </button>
        <button className="calc-mem-btn" onClick={() => memoryAction("M+")}>
          M+
        </button>
        <button className="calc-mem-btn" onClick={() => memoryAction("M-")}>
          M−
        </button>
        {memory !== null && <span className="calc-mem-indicator">M</span>}
      </div>
      <div className="calc-display">{display}</div>
      <div className="calc-grid">
        {BUTTONS.map((btn) => {
          const isOp = ["÷", "×", "−", "+"].includes(btn);
          const isEquals = btn === "=";
          return (
            <button
              key={btn}
              className="calc-btn"
              data-op={isOp}
              data-equals={isEquals}
              style={btn === "0" ? { gridColumn: "span 2" } : undefined}
              onClick={() => (/[0-9.]/.test(btn) ? inputDigit(btn) : onOperator(btn))}
            >
              {btn}
            </button>
          );
        })}
      </div>
      {history.length > 0 && (
        <div className="calc-history">
          <div className="calc-history-header">
            <span>History</span>
            <button className="calc-history-clear" onClick={() => setHistory([])}>
              Clear
            </button>
          </div>
          {history.map((h, i) => (
            <div key={i} className="calc-history-row" onClick={() => setDisplay(h.result)}>
              <span className="calc-history-expr">{h.expression}</span>
              <span className="calc-history-result">= {h.result}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
