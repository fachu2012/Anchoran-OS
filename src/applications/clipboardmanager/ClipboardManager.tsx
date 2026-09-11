import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useClipboardHistoryStore } from "@/core/clipboardHistoryStore";
import "@/applications/apps.css";
import "./clipboardmanager.css";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ClipboardManagerApp() {
  const entries = useClipboardHistoryStore((s) => s.entries);
  const remove = useClipboardHistoryStore((s) => s.remove);
  const clear = useClipboardHistoryStore((s) => s.clear);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyBack(id: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1200);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <span style={{ fontSize: 12.5, color: "var(--anchoran-text-secondary)" }}>
          {entries.length} item{entries.length === 1 ? "" : "s"}
        </span>
        {entries.length > 0 && (
          <button className="app-toolbar-btn" onClick={clear} style={{ marginLeft: "auto" }}>
            Clear all
          </button>
        )}
      </div>
      <div className="app-content clipboard-content">
        {entries.length === 0 ? (
          <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5, padding: 12 }}>
            Copy some text anywhere in Anchoran and it will show up here.
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="clipboard-row" onClick={() => copyBack(e.id, e.text)}>
              <div className="clipboard-row-text">{e.text}</div>
              <div className="clipboard-row-meta">
                <span>{formatTime(e.copiedAt)}</span>
                {copiedId === e.id && <span className="clipboard-copied">Copied</span>}
                <button
                  className="todo-remove"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    remove(e.id);
                  }}
                  aria-label="Delete"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
