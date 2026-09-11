import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./clock.css";

const WORLD_CLOCKS = [
  { label: "Local", zone: undefined },
  { label: "New York", zone: "America/New_York" },
  { label: "London", zone: "Europe/London" },
  { label: "Tokyo", zone: "Asia/Tokyo" },
  { label: "Buenos Aires", zone: "America/Argentina/Buenos_Aires" },
];

type Tab = "world" | "stopwatch" | "timer";

function formatElapsed(ms: number) {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function ClockApp() {
  const [tab, setTab] = useState<Tab>("world");

  return (
    <div className="app-root">
      <div className="app-toolbar">
        {(["world", "stopwatch", "timer"] as Tab[]).map((t) => (
          <button key={t} className="app-toolbar-btn" data-op={tab === t} onClick={() => setTab(t)}>
            {t === "world" ? "World Clock" : t === "stopwatch" ? "Stopwatch" : "Timer"}
          </button>
        ))}
      </div>
      <div className="app-content">
        {tab === "world" && <WorldClockTab />}
        {tab === "stopwatch" && <StopwatchTab />}
        {tab === "timer" && <TimerTab />}
      </div>
    </div>
  );
}

function WorldClockTab() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="clock-world-list">
      {WORLD_CLOCKS.map((c) => (
        <div key={c.label} className="clock-world-row">
          <span className="clock-world-label">{c.label}</span>
          <span className="clock-world-time">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: c.zone })}
          </span>
        </div>
      ))}
    </div>
  );
}

function StopwatchTab() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = performance.now() - elapsed;
    function tick() {
      setElapsed(performance.now() - startRef.current);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return (
    <div className="clock-stopwatch">
      <div className="clock-stopwatch-display">{formatElapsed(elapsed)}</div>
      <div className="clock-stopwatch-controls">
        <button className="app-toolbar-btn" onClick={() => setRunning((r) => !r)}>
          {running ? "Stop" : "Start"}
        </button>
        <button
          className="app-toolbar-btn"
          onClick={() => {
            if (running) setLaps((l) => [elapsed, ...l]);
            else {
              setElapsed(0);
              setLaps([]);
            }
          }}
        >
          {running ? "Lap" : "Reset"}
        </button>
      </div>
      {laps.length > 0 && (
        <div className="clock-laps">
          {laps.map((lap, i) => (
            <div key={i} className="clock-lap-row">
              <span>Lap {laps.length - i}</span>
              <span>{formatElapsed(lap)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimerTab() {
  const [minutesInput, setMinutesInput] = useState(5);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const pushNotification = useNotificationStore((s) => s.push);
  const endRef = useRef(0);

  useEffect(() => {
    if (remainingMs === null) return;
    if (remainingMs <= 0) {
      pushNotification("Timer", "Time's up.");
      setRemainingMs(null);
      return;
    }
    const t = setTimeout(() => setRemainingMs(Math.max(0, endRef.current - Date.now())), 250);
    return () => clearTimeout(t);
  }, [remainingMs, pushNotification]);

  function start() {
    endRef.current = Date.now() + minutesInput * 60_000;
    setRemainingMs(minutesInput * 60_000);
  }

  const displaySeconds = remainingMs !== null ? Math.ceil(remainingMs / 1000) : minutesInput * 60;
  const mm = Math.floor(displaySeconds / 60);
  const ss = displaySeconds % 60;

  return (
    <div className="clock-timer">
      <div className="clock-stopwatch-display">
        {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
      </div>
      {remainingMs === null ? (
        <div className="clock-timer-controls">
          <input
            type="number"
            min={1}
            max={180}
            value={minutesInput}
            onChange={(e) => setMinutesInput(Math.max(1, Number(e.target.value)))}
            className="clock-timer-input"
          />
          <span style={{ fontSize: 12.5, color: "var(--anchoran-text-secondary)" }}>minutes</span>
          <button className="app-toolbar-btn" onClick={start}>
            <Icon name="clock" size={14} /> Start
          </button>
        </div>
      ) : (
        <button className="app-toolbar-btn" onClick={() => setRemainingMs(null)}>
          Cancel
        </button>
      )}
    </div>
  );
}
