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
        setDisplay(String(result));
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

  return (
    <div className="calc-root">
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
    </div>
  );
}
