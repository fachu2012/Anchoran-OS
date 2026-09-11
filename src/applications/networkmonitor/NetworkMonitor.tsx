import { useEffect, useState } from "react";
import "@/applications/apps.css";
import "./networkmonitor.css";

interface PingResult {
  id: number;
  ms: number | null;
  at: number;
}

const PING_URL = "https://api.frankfurter.app/currencies";

export function NetworkMonitorApp() {
  const [online, setOnline] = useState(navigator.onLine);
  const [history, setHistory] = useState<PingResult[]>([]);
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } })
    .connection;

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let id = 0;

    async function ping() {
      const start = performance.now();
      try {
        await fetch(PING_URL, { cache: "no-store" });
        if (!cancelled) {
          const ms = Math.round(performance.now() - start);
          setHistory((h) => [{ id: id++, ms, at: Date.now() }, ...h].slice(0, 20));
        }
      } catch {
        if (!cancelled) setHistory((h) => [{ id: id++, ms: null, at: Date.now() }, ...h].slice(0, 20));
      }
    }

    ping();
    const interval = setInterval(ping, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const latest = history[0];
  const avg = history.filter((h) => h.ms !== null).length
    ? Math.round(
        history.filter((h) => h.ms !== null).reduce((a, h) => a + (h.ms ?? 0), 0) /
          history.filter((h) => h.ms !== null).length
      )
    : null;

  return (
    <div className="app-root">
      <div className="app-content networkmonitor-content">
        <div className="networkmonitor-grid">
          <div className="sysmon-card">
            <div className="sysmon-card-label">Status</div>
            <div className="sysmon-card-value" style={{ color: online ? "var(--anchoran-accent)" : "#E5484D" }}>
              {online ? "Online" : "Offline"}
            </div>
          </div>
          <div className="sysmon-card">
            <div className="sysmon-card-label">Latency</div>
            <div className="sysmon-card-value">{latest?.ms !== undefined && latest.ms !== null ? `${latest.ms} ms` : "—"}</div>
          </div>
          <div className="sysmon-card">
            <div className="sysmon-card-label">Average (last 20)</div>
            <div className="sysmon-card-value">{avg !== null ? `${avg} ms` : "—"}</div>
          </div>
          {connection?.effectiveType && (
            <div className="sysmon-card">
              <div className="sysmon-card-label">Connection type</div>
              <div className="sysmon-card-value">{connection.effectiveType}</div>
            </div>
          )}
        </div>
        <div className="networkmonitor-history">
          {history.map((h) => (
            <div key={h.id} className="networkmonitor-row">
              <span>{new Date(h.at).toLocaleTimeString()}</span>
              <span data-fail={h.ms === null}>{h.ms !== null ? `${h.ms} ms` : "Failed"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
