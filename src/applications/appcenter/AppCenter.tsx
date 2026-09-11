import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { APP_LIST } from "@/applications/registry";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useNotificationStore } from "@/notifications/notificationStore";
import { persistGet, persistSet } from "@/core/persist";
import type { AppCategory, AppId } from "@/core/types";
import "@/applications/apps.css";
import "./webstore.css";

const INSTALLED_KEY = "installedApps";
const CATEGORIES: (AppCategory | "All")[] = ["All", "System", "Productivity", "Utilities", "Internet"];

// A handful of apps ship pre-installed (the ones that make Anchoran
// usable day one); the rest — including the newest additions — start
// available to install from the Webstore, so it has real content
// instead of everything already being there.
const DEFAULT_INSTALLED: AppId[] = ["files", "terminal", "settings", "notes", "calculator", "browser", "systemMonitor"];

/**
 * All apps ship built into Anchoran; "install" here is a simulated
 * state toggle (per the spec: "Inicialmente la instalación puede ser
 * simulada") rather than a real package manager — but the choice of
 * what's installed persists like a real one would.
 */
export function AppCenterApp() {
  const [installed, setInstalled] = useState<Set<AppId>>(new Set(DEFAULT_INSTALLED));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [selected, setSelected] = useState<AppId | null>(null);
  const openApp = useWindowStore((s) => s.openApp);
  const pushNotification = useNotificationStore((s) => s.push);

  useEffect(() => {
    persistGet<AppId[]>("config", INSTALLED_KEY, DEFAULT_INSTALLED).then((loaded) =>
      setInstalled(new Set(loaded))
    );
  }, []);

  function install(appId: AppId, title: string) {
    setInstalled((prev) => {
      const next = new Set(prev).add(appId);
      persistSet("config", INSTALLED_KEY, Array.from(next));
      return next;
    });
    pushNotification("Anchoran Webstore", `${title} was installed.`);
  }

  const apps = APP_LIST.filter((a) => a.id !== "appCenter");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((a) => {
      const matchesCategory = category === "All" || a.category === category;
      const matchesQuery = !q || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [apps, query, category]);

  const detail = selected ? apps.find((a) => a.id === selected) : null;

  return (
    <div className="webstore-root">
      <div className="webstore-sidebar">
        <div className="webstore-search">
          <Icon name="search" size={14} />
          <input placeholder="Search apps…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {CATEGORIES.map((c) => (
          <button key={c} className="webstore-category" data-active={category === c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="webstore-main">
        {detail ? (
          <div className="webstore-detail">
            <button className="webstore-back" onClick={() => setSelected(null)}>
              ← Back
            </button>
            <div className="webstore-detail-header">
              <div className="webstore-icon-badge webstore-icon-badge-lg">
                <Icon name={detail.icon as IconName} size={32} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: 500 }}>{detail.title}</h2>
                <div className="webstore-detail-category">{detail.category}</div>
              </div>
            </div>
            <p className="webstore-detail-description">{detail.description}</p>
            {installed.has(detail.id) ? (
              <button className="app-toolbar-btn" onClick={() => openApp(detail.id)}>
                Open
              </button>
            ) : (
              <button className="app-toolbar-btn" onClick={() => install(detail.id, detail.title)}>
                Install
              </button>
            )}
          </div>
        ) : (
          <div className="webstore-grid">
            {filtered.map((app) => {
              const isInstalled = installed.has(app.id);
              return (
                <div className="webstore-card" key={app.id} onClick={() => setSelected(app.id)}>
                  <div className="webstore-icon-badge">
                    <Icon name={app.icon as IconName} size={20} />
                  </div>
                  <div className="webstore-card-body">
                    <div className="webstore-card-title">{app.title}</div>
                    <div className="webstore-card-desc">{app.description}</div>
                  </div>
                  <button
                    className="app-toolbar-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isInstalled) openApp(app.id);
                      else install(app.id, app.title);
                    }}
                  >
                    {isInstalled ? "Open" : "Install"}
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 13, padding: 20 }}>
                No apps found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
