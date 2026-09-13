import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { IconTile } from "@/components/IconTile";
import { APP_LIST } from "@/applications/registry";
import { fetchWebstoreCatalog } from "@/applications/webstoreRegistry";
import { useInstalledAppsStore, isProtectedApp, isCoreApp } from "@/applications/installedAppsStore";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useNotificationStore } from "@/notifications/notificationStore";
import { AdminPinPrompt } from "@/core/AdminPinPrompt";
import type { AppCategory, AppId, AppDefinition } from "@/core/types";
import { ANCHORAN_VERSION } from "@/core/version";
import "@/applications/apps.css";
import "./webstore.css";

const CATEGORIES: (AppCategory | "All")[] = ["All", "System", "Productivity", "Utilities", "Internet", "Games"];

/**
 * All apps ship built into this version of Anchoran; "install" is a
 * local toggle (per the spec: "Inicialmente la instalación puede ser
 * simulada"), not a real package manager fetching new code — but the
 * *catalog* itself is real, fetched from the GitHub Release matching
 * the running version, so it only ever shows what actually existed as
 * of that version. See webstoreRegistry.ts.
 */
export function AppCenterApp() {
  const [catalog, setCatalog] = useState<AppDefinition[]>(APP_LIST);
  const [isRemoteCatalog, setIsRemoteCatalog] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [selected, setSelected] = useState<AppId | null>(null);
  const openApp = useWindowStore((s) => s.openApp);
  const pushNotification = useNotificationStore((s) => s.push);
  const installed = useInstalledAppsStore((s) => s.installed);
  const install = useInstalledAppsStore((s) => s.install);
  const uninstall = useInstalledAppsStore((s) => s.uninstall);

  useEffect(() => {
    fetchWebstoreCatalog().then(({ apps, isRemote }) => {
      setCatalog(apps);
      setIsRemoteCatalog(isRemote);
    });
  }, []);

  const apps = catalog.filter((a) => a.id !== "appCenter");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((a) => {
      const matchesCategory = category === "All" || a.category === category;
      const matchesQuery = !q || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [apps, query, category]);

  const detail = selected ? apps.find((a) => a.id === selected) : null;
  const [uninstallPin, setUninstallPin] = useState<AppDefinition | null>(null);

  function onInstall(app: AppDefinition) {
    install(app.id);
    pushNotification("Anchoran Webstore", `${app.title} was installed.`);
  }
  function onUninstall(app: AppDefinition) {
    if (isProtectedApp(app.id)) {
      setUninstallPin(app);
      return;
    }
    uninstall(app.id);
    pushNotification("Anchoran Webstore", `${app.title} was uninstalled.`);
  }

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
        <div className="webstore-catalog-note">
          {isRemoteCatalog
            ? `Catalog for Anchoran ${ANCHORAN_VERSION}`
            : "Offline — showing this build's bundled catalog"}
        </div>
      </div>

      <div className="webstore-main">
        {detail ? (
          <div className="webstore-detail">
            <button className="webstore-back" onClick={() => setSelected(null)}>
              ← Back
            </button>
            <div className="webstore-detail-header">
              <IconTile name={detail.icon as IconName} size={64} glyphScale={0.5} />
              <div>
                <h2 style={{ margin: 0, fontWeight: 500 }}>{detail.title}</h2>
                <div className="webstore-detail-category">{detail.category}</div>
              </div>
            </div>
            <p className="webstore-detail-description">{detail.description}</p>
            <div style={{ display: "flex", gap: 8 }}>
              {installed.has(detail.id) ? (
                <>
                  <button className="app-toolbar-btn" onClick={() => openApp(detail.id)}>
                    Open
                  </button>
                  {!isCoreApp(detail.id) && (
                    <button className="app-toolbar-btn" onClick={() => onUninstall(detail)}>
                      {isProtectedApp(detail.id) ? "Uninstall… (requires admin PIN)" : "Uninstall"}
                    </button>
                  )}
                </>
              ) : (
                <button className="app-toolbar-btn" onClick={() => onInstall(detail)}>
                  Install
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="webstore-grid">
            {filtered.map((app) => {
              const isInstalled = installed.has(app.id);
              return (
                <div className="webstore-card" key={app.id} onClick={() => setSelected(app.id)}>
                  <IconTile name={app.icon as IconName} size={40} glyphScale={0.5} />
                  <div className="webstore-card-body">
                    <div className="webstore-card-title">{app.title}</div>
                    <div className="webstore-card-desc">{app.description}</div>
                  </div>
                  <button
                    className="app-toolbar-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isInstalled) openApp(app.id);
                      else onInstall(app);
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

      {uninstallPin && (
        <AdminPinPrompt
          onCancel={() => setUninstallPin(null)}
          onSuccess={() => {
            uninstall(uninstallPin.id, { force: true });
            pushNotification("Anchoran Webstore", `${uninstallPin.title} was uninstalled.`);
            setUninstallPin(null);
          }}
        />
      )}
    </div>
  );
}
