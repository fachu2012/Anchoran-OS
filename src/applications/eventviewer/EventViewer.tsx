import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./eventviewer.css";

function parseLine(line: string): { time: string; scope: string; message: string } {
  const match = line.match(/^\[(.+?)\] \[(.+?)\] (.*)$/);
  if (!match) return { time: "", scope: "", message: line };
  return { time: match[1], scope: match[2], message: match[3] };
}

interface MinuteGroup {
  key: string;
  label: string;
  lines: string[];
}

// Consecutive lines sharing the same minute (down to HH:MM, seconds
// dropped) are folded into one group, so "everything that happened in
// this marked minute" can be copied as one block instead of one row
// at a time.
function groupByMinute(lines: string[]): MinuteGroup[] {
  const groups: MinuteGroup[] = [];
  for (const line of lines) {
    const { time } = parseLine(line);
    const date = time ? new Date(time) : null;
    const valid = date && !Number.isNaN(date.getTime());
    const key = valid ? date!.toISOString().slice(0, 16) : "unknown";
    const label = valid
      ? date!.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
      : "Unknown time";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.lines.push(line);
    else groups.push({ key, label, lines: [line] });
  }
  return groups;
}

export function EventViewerApp() {
  const [lines, setLines] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");
  const pushNotification = useNotificationStore((s) => s.push);

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
  const groups = useMemo(() => groupByMinute(filtered), [filtered]);

  async function copyGroup(group: MinuteGroup) {
    try {
      await navigator.clipboard.writeText(group.lines.join("\n"));
      pushNotification(
        "Event Viewer",
        `Copied ${group.lines.length} event${group.lines.length === 1 ? "" : "s"} from ${group.label}.`
      );
    } catch {
      pushNotification("Event Viewer", "Couldn't copy to the clipboard.");
    }
  }

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
        {groups.map((group, gi) => (
          <div key={`${group.key}-${gi}`} className="eventviewer-group">
            <div className="eventviewer-group-header">
              <span>{group.label}</span>
              <span className="eventviewer-group-count">
                {group.lines.length} event{group.lines.length === 1 ? "" : "s"}
              </span>
              <button className="app-toolbar-btn" onClick={() => copyGroup(group)}>
                <Icon name="copy" size={12} /> Copy minute
              </button>
            </div>
            {group.lines.map((line, i) => {
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
        ))}
      </div>
    </div>
  );
}
