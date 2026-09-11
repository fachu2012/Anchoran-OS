import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./eventviewer.css";

function parseLine(line: string): { time: string; scope: string; message: string } {
  const match = line.match(/^\[(.+?)\] \[(.+?)\] (.*)$/);
  if (!match) return { time: "", scope: "", message: line };
  return { time: match[1], scope: match[2], message: match[3] };
}

export function EventViewerApp() {
  const [lines, setLines] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    if (!window.anchoran) {
      setLines([]);
      return;
    }
    setLines(await window.anchoran.readLog());
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = (lines ?? []).filter((l) => l.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={load}>
          <Icon name="restart" size={13} /> Refresh
        </button>
        <input
          placeholder="Filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            border: "1px solid var(--anchoran-border)",
            borderRadius: 6,
            padding: "5px 9px",
            background: "var(--anchoran-bg)",
            color: "var(--anchoran-text-primary)",
            fontSize: 12.5,
            width: 160,
            marginLeft: "auto",
          }}
        />
      </div>
      <div className="app-content eventviewer-content">
        {lines === null && <div className="eventviewer-empty">Loading…</div>}
        {lines?.length === 0 && (
          <div className="eventviewer-empty">
            No events logged yet — Anchoran only writes here when something noteworthy happens (errors, shortcut
            registration, update checks).
          </div>
        )}
        {filtered.map((line, i) => {
          const { time, scope, message } = parseLine(line);
          const isError = scope.toLowerCase().includes("error") || scope.toLowerCase().includes("exception");
          return (
            <div key={i} className="eventviewer-row" data-error={isError}>
              <span className="eventviewer-time">{time ? new Date(time).toLocaleString() : ""}</span>
              <span className="eventviewer-scope">{scope}</span>
              <span className="eventviewer-message">{message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
