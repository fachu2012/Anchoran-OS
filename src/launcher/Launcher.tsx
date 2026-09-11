import { useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { APP_LIST } from "@/applications/registry";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useTaskbarStore } from "@/desktop/taskbarStore";
import "./launcher.css";

export function Launcher({ onClose, onPower }: { onClose: () => void; onPower: () => void }) {
  const [query, setQuery] = useState("");
  const openApp = useWindowStore((s) => s.openApp);
  const pinned = useTaskbarStore((s) => s.pinned);
  const pin = useTaskbarStore((s) => s.pin);
  const unpin = useTaskbarStore((s) => s.unpin);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return APP_LIST;
    return APP_LIST.filter((a) => a.title.toLowerCase().includes(q));
  }, [query]);

  function launch(appId: (typeof APP_LIST)[number]["id"]) {
    openApp(appId);
    onClose();
  }

  return (
    <div className="launcher-backdrop" onClick={onClose}>
      <div className="launcher-panel" onClick={(e) => e.stopPropagation()}>
        <div className="launcher-search">
          <Icon name="search" size={18} />
          <input
            autoFocus
            placeholder="Search applications…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) launch(results[0].id);
              if (e.key === "Escape") onClose();
            }}
          />
        </div>
        <div className="launcher-results">
          {results.map((app, i) => {
            const isPinned = pinned.includes(app.id);
            return (
              <div key={app.id} className="launcher-item" data-active={i === 0}>
                <button className="launcher-item-main" onClick={() => launch(app.id)}>
                  <span className="launcher-item-icon">
                    <Icon name={app.icon as IconName} size={18} />
                  </span>
                  {app.title}
                </button>
                <button
                  className="launcher-item-pin"
                  data-pinned={isPinned}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isPinned) unpin(app.id);
                    else pin(app.id);
                  }}
                  aria-label={isPinned ? `Unpin ${app.title}` : `Pin ${app.title} to taskbar`}
                  title={isPinned ? "Unpin from taskbar" : "Pin to taskbar"}
                >
                  <Icon name="pin" size={14} />
                </button>
              </div>
            );
          })}
          {results.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: "var(--anchoran-text-secondary)" }}>
              No applications found.
            </div>
          )}
        </div>
        <div className="launcher-footer">
          <button
            onClick={() => {
              onClose();
              openApp("settings");
            }}
          >
            <Icon name="settings" size={14} /> Settings
          </button>
          <button
            onClick={() => {
              onClose();
              onPower();
            }}
          >
            <Icon name="power" size={14} /> Power
          </button>
        </div>
      </div>
    </div>
  );
}
