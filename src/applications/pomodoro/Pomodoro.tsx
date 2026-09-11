import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./pomodoro.css";

type Mode = "focus" | "short" | "long";

const DURATIONS: Record<Mode, number> = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

const LABELS: Record<Mode, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
};

export function PomodoroApp() {
  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(intervalRef.current!);
          setRunning(false);
          if (mode === "focus") setCycles((c) => c + 1);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running, mode]);

  function switchMode(next: Mode) {
    setMode(next);
    setRunning(false);
    setSecondsLeft(DURATIONS[next]);
  }

  function reset() {
    setRunning(false);
    setSecondsLeft(DURATIONS[mode]);
  }

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");
  const progress = 1 - secondsLeft / DURATIONS[mode];

  return (
    <div className="app-root">
      <div className="app-toolbar">
        {(Object.keys(LABELS) as Mode[]).map((m) => (
          <button key={m} className="app-toolbar-btn" data-op={mode === m} onClick={() => switchMode(m)}>
            {LABELS[m]}
          </button>
        ))}
      </div>
      <div className="app-content pomodoro-content">
        <div className="pomodoro-ring" style={{ ["--progress" as string]: progress }}>
          <div className="pomodoro-time">
            {mins}:{secs}
          </div>
        </div>
        <div className="pomodoro-controls">
          <button className="app-toolbar-btn" onClick={() => setRunning((r) => !r)}>
            {running ? "Pause" : "Start"}
          </button>
          <button className="app-toolbar-btn" onClick={reset}>
            <Icon name="restart" size={14} /> Reset
          </button>
        </div>
        <div className="pomodoro-cycles">{cycles} focus session{cycles === 1 ? "" : "s"} completed</div>
      </div>
    </div>
  );
}
