import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { IconTile } from "@/components/IconTile";
import { fetchPluginCatalog, type PluginManifest } from "@/applications/appcenter/pluginCatalog";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useNotificationStore } from "@/notifications/notificationStore";
import { ANCHORAN_SIMPLIFIED_VERSION, compareVersions } from "@/core/buildNumber";
import { ANCHORAN_VERSION } from "@/core/version";
import { renderMarkdown } from "@/core/markdown";
import { isAutoUpdateEnabled, setAutoUpdateEnabled } from "@/core/pluginAutoUpdate";
import "@/applications/apps.css";
import "./webstore.css";

const CATEGORIES = ["Community", "My Creations"] as const;

/** Community's own category filter — a plugin's optional `category` field uses one of these; "All" always shows everything, including a plugin with no category set. */
const PLUGIN_CATEGORIES = ["All", "Games", "Productivity", "Utilities", "Internet", "System"] as const;

/**
 * Plugins that, once installed, can never be uninstalled from here —
 * the plugin-catalog equivalent of a core app's PROTECTED_APP_IDS.
 * Empty on purpose: even Anchoran Code Studio (the tool "My
 * Creations" depends on) can be uninstalled like any other plugin —
 * doing so just leaves existing local projects unopenable until it's
 * reinstalled, which is an acceptable, explicit user choice, not a
 * state Anchoran needs to prevent.
 */
const PROTECTED_PLUGIN_IDS = new Set<string>([]);

/**
 * Anchoran Code Studio's own local-project index — a small, separate
 * contract between it and this Webstore, not part of the Anchoran App
 * SDK itself: Code Studio keeps this key updated with one lightweight
 * entry per project the user has created or forked locally (full file
 * trees live under their own "anchoran-plugin:code-studio:project:
 * <id>" key, untouched here). "My Creations" reads it directly since
 * every Anchoran window shares the same localStorage origin — no IPC
 * needed for something this local.
 */
const CODE_STUDIO_PROJECTS_KEY = "anchoran-plugin:code-studio:projects";

interface LocalCreation {
  id: string;
  name: string;
  description?: string;
  /** A data: URL from an imported image, or empty/absent for the default icon. */
  icon?: string;
}

function readLocalCreations(): LocalCreation[] {
  try {
    const raw = localStorage.getItem(CODE_STUDIO_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.id === "string" && typeof p.name === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Anchoran's own bundled apps (Files, Terminal, Settings, the default
 * text/photo/media handlers, …) aren't "from" the Webstore at all —
 * they ship with the OS itself and, as of the Anchoran App SDK
 * migration, every one of them is permanently installed
 * (installedAppsStore's PROTECTED_APP_IDS has no exceptions left). So
 * this app only ever shows what's genuinely downloadable: real
 * third-party plugins from the separate Anchoran-Webstore repo
 * (Community) and the user's own local Code Studio projects (My
 * Creations) — nothing here is simulated or toggled, it's either
 * really downloaded or it's really local.
 */
export function AppCenterApp() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Community");
  const [pluginCategory, setPluginCategory] = useState<(typeof PLUGIN_CATEGORIES)[number]>("All");
  const openApp = useWindowStore((s) => s.openApp);
  const pushNotification = useNotificationStore((s) => s.push);

  // Community plugins — fetched from the Anchoran-Webstore repo's own
  // latest release, entirely independent of which Anchoran OS version
  // is running, so a new or updated plugin shows up here without
  // Anchoran OS ever needing a new release of its own. See pluginCatalog.ts.
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<Set<string>>(new Set());
  const [installedVersions, setInstalledVersions] = useState<Record<string, string | undefined>>({});
  // Forces the Auto-update checkbox to re-render after a toggle — the
  // preference itself lives in localStorage (pluginAutoUpdate.ts), not
  // React state, since PluginHost.tsx (a totally separate window) also
  // needs to read it.
  const [autoUpdateVersion, setAutoUpdateVersion] = useState(0);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginManifest | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const [pluginBusy, setPluginBusy] = useState<string | null>(null);
  const [webstoreChangelog, setWebstoreChangelog] = useState<string | null>(null);
  const [webstoreChangelogLoading, setWebstoreChangelogLoading] = useState(false);

  // "My Creations" — local-only Code Studio projects. Re-read whenever
  // this tab becomes active, since they change from inside a totally
  // separate plugin window (Code Studio), not from anything AppCenter
  // itself does — a mount-only read would go stale the moment someone
  // creates, renames, or deletes a project and comes back here.
  const [creations, setCreations] = useState<LocalCreation[]>([]);

  useEffect(() => {
    fetchPluginCatalog().then(async ({ plugins: list }) => {
      setPlugins(list);
      if (!window.anchoran) return;
      const checks = await Promise.all(list.map((p) => window.anchoran!.pluginIsInstalled(p.id)));
      const installed = list.filter((_, i) => checks[i]);
      setInstalledPlugins(new Set(installed.map((p) => p.id)));
      const installedManifests = await window.anchoran!.pluginListInstalled();
      setInstalledVersions(Object.fromEntries(installedManifests.map((m) => [m.id, m.version])));
      // Self-healing backfill: a plugin installed before manifest.json
      // existed (e.g. Anchoran Code Studio, on any install from before
      // this shipped) has no local title/icon of its own yet, so the
      // Launcher fell back to its raw id + a generic icon. Every
      // installed, still-cataloged plugin gets its manifest refreshed
      // from the live catalog each time this tab opens — cheap, and
      // also keeps it in sync if the catalog's own title/icon change.
      installed.forEach((p) => window.anchoran!.pluginSetManifest(p.id, { title: p.title, icon: p.icon }));
    });
  }, []);

  useEffect(() => {
    if (category === "My Creations") setCreations(readLocalCreations());
  }, [category]);

  // Opening a plugin's detail view (or going back to the grid) reuses
  // the same scrollable .webstore-main container instead of mounting a
  // fresh one, so its scrollTop otherwise carries over untouched — a
  // long "Version history" list could leave the grid scrolled down,
  // and the very next plugin opened would then render already scrolled
  // near its own bottom instead of starting at the top.
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0 });
  }, [selectedPlugin, category]);

  function openCreation(creation: LocalCreation) {
    openApp("pluginHost", { pluginId: "code-studio", title: creation.name, openPath: creation.id });
  }

  function deleteCreation(creation: LocalCreation) {
    const next = readLocalCreations().filter((c) => c.id !== creation.id);
    localStorage.setItem(CODE_STUDIO_PROJECTS_KEY, JSON.stringify(next));
    localStorage.removeItem(`anchoran-plugin:code-studio:project:${creation.id}`);
    setCreations(next);
    pushNotification("Anchoran Webstore", `"${creation.name}" was deleted.`);
  }

  // The Webstore's own release notes — a totally separate CHANGELOG.md
  // from Anchoran OS's own (fetched by Settings' "What's new"), read
  // live from the Anchoran-Webstore repo since that's what its
  // catalog.json/plugin versions actually track. Same read-only
  // markdown panel as Settings' "What's new", just pointed at a
  // different repo.
  async function showWebstoreChangelog() {
    setWebstoreChangelogLoading(true);
    try {
      const res = await fetch("https://raw.githubusercontent.com/fachu2012/Anchoran-Webstore/main/CHANGELOG.md");
      if (!res.ok) throw new Error(String(res.status));
      setWebstoreChangelog(await res.text());
    } catch {
      setWebstoreChangelog("Couldn't reach GitHub to fetch the Webstore's changelog.");
    } finally {
      setWebstoreChangelogLoading(false);
    }
  }

  async function onInstallPlugin(plugin: PluginManifest) {
    if (!window.anchoran) return;
    setPluginBusy(plugin.id);
    const result = await window.anchoran.pluginInstall(plugin.id, plugin.entry, { title: plugin.title, icon: plugin.icon, version: plugin.version });
    setPluginBusy(null);
    if (result.success) {
      setInstalledPlugins((prev) => new Set(prev).add(plugin.id));
      setInstalledVersions((prev) => ({ ...prev, [plugin.id]: plugin.version }));
      pushNotification("Anchoran Webstore", `${plugin.title} was installed.`);
    } else {
      pushNotification("Anchoran Webstore", result.error ?? `Couldn't install ${plugin.title}.`);
    }
  }

  // Same download as Install, just re-run over an already-installed
  // plugin to bring it up to the catalog's current version — the
  // manual "Update" button in the detail view, and what a plugin's
  // own Auto-update toggle triggers automatically from PluginHost.tsx
  // right before opening it.
  async function onUpdatePlugin(plugin: PluginManifest) {
    if (!window.anchoran) return;
    setPluginBusy(plugin.id);
    const result = await window.anchoran.pluginInstall(plugin.id, plugin.entry, { title: plugin.title, icon: plugin.icon, version: plugin.version });
    setPluginBusy(null);
    if (result.success) {
      setInstalledVersions((prev) => ({ ...prev, [plugin.id]: plugin.version }));
      pushNotification("Anchoran Webstore", `${plugin.title} was updated to v${plugin.version}.`);
    } else {
      pushNotification("Anchoran Webstore", result.error ?? `Couldn't update ${plugin.title}.`);
    }
  }

  async function onUninstallPlugin(plugin: PluginManifest) {
    if (PROTECTED_PLUGIN_IDS.has(plugin.id)) {
      pushNotification("Anchoran Webstore", `${plugin.title} is a core tool and can't be uninstalled.`);
      return;
    }
    if (!window.anchoran) return;
    setPluginBusy(plugin.id);
    const result = await window.anchoran.pluginUninstall(plugin.id);
    setPluginBusy(null);
    if (result.success) {
      setInstalledPlugins((prev) => {
        const next = new Set(prev);
        next.delete(plugin.id);
        return next;
      });
      pushNotification("Anchoran Webstore", `${plugin.title} was uninstalled.`);
    } else {
      pushNotification("Anchoran Webstore", result.error ?? `Couldn't uninstall ${plugin.title}.`);
    }
  }

  const filteredPlugins = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plugins
      .filter((p) => !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      .filter((p) => pluginCategory === "All" || p.category === pluginCategory);
  }, [plugins, query, pluginCategory]);

  return (
    <div className="webstore-root">
      <div className="webstore-sidebar">
        <div className="webstore-search">
          <Icon name="search" size={14} />
          <input placeholder="Search Community apps…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {CATEGORIES.map((c) => (
          <button key={c} className="webstore-category" data-active={category === c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
        {category === "Community" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "4px 10px 2px" }}>
            {PLUGIN_CATEGORIES.map((c) => (
              <button
                key={c}
                className="webstore-category"
                data-active={pluginCategory === c}
                style={{ fontSize: 11, padding: "3px 8px" }}
                onClick={() => setPluginCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <button className="app-toolbar-btn" style={{ margin: "8px 10px 0" }} onClick={showWebstoreChangelog} disabled={webstoreChangelogLoading}>
          Changelog
        </button>
        <div className="webstore-version-stamp">Anchoran Webstore · {ANCHORAN_SIMPLIFIED_VERSION}</div>
      </div>
      {webstoreChangelog !== null && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setWebstoreChangelog(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(90%, 560px)",
              maxHeight: "78vh",
              overflowY: "auto",
              background: "var(--anchoran-surface)",
              borderRadius: "var(--anchoran-radius-lg)",
              boxShadow: "var(--anchoran-shadow-window)",
              padding: 22,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Changelog</span>
              <button className="app-toolbar-btn" onClick={() => setWebstoreChangelog(null)}>Close</button>
            </div>
            <div className="notes-preview" style={{ padding: 0 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(webstoreChangelog) }} />
          </div>
        </div>
      )}

      <div className="webstore-main" ref={mainScrollRef}>
        {category === "Community" ? (
          selectedPlugin ? (
            <div className="webstore-detail">
              <button className="webstore-back" onClick={() => setSelectedPlugin(null)}>
                ← Back
              </button>
              <div className="webstore-detail-header">
                <IconTile name={selectedPlugin.icon as IconName} size={64} glyphScale={0.5} />
                <div>
                  <h2 style={{ margin: 0, fontWeight: 500 }}>{selectedPlugin.title}</h2>
                  <div className="webstore-detail-category">
                    Community · v{selectedPlugin.version}
                    {installedPlugins.has(selectedPlugin.id) && (
                      <> · installed: {installedVersions[selectedPlugin.id] ? `v${installedVersions[selectedPlugin.id]}` : "unknown version"}</>
                    )}
                    {" · "}by {selectedPlugin.author ?? "Unknown"} · requires Anchoran{" "}
                    {compareVersions(ANCHORAN_VERSION, selectedPlugin.minAnchoranVersion) < 0
                      ? `v${selectedPlugin.minAnchoranVersion}+ (you're on an older build)`
                      : `v${selectedPlugin.minAnchoranVersion}+`}
                  </div>
                </div>
              </div>
              {/* Actions come right after the header, BEFORE the
                  description/changelog below — a long changelog used
                  to push Open/Install/Uninstall far down the page,
                  and burying "what version do I actually have" with it. */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "14px 0 16px" }}>
                {installedPlugins.has(selectedPlugin.id) ? (
                  <>
                    <button
                      className="app-toolbar-btn"
                      onClick={() => openApp("pluginHost", { pluginId: selectedPlugin.id, title: selectedPlugin.title })}
                    >
                      Open
                    </button>
                    {installedVersions[selectedPlugin.id] !== selectedPlugin.version && (
                      <button
                        className="app-toolbar-btn"
                        disabled={pluginBusy === selectedPlugin.id}
                        onClick={() => onUpdatePlugin(selectedPlugin)}
                      >
                        {pluginBusy === selectedPlugin.id ? "Updating…" : `Update to v${selectedPlugin.version}`}
                      </button>
                    )}
                    {!PROTECTED_PLUGIN_IDS.has(selectedPlugin.id) && (
                      <button
                        className="app-toolbar-btn"
                        disabled={pluginBusy === selectedPlugin.id}
                        onClick={() => onUninstallPlugin(selectedPlugin)}
                      >
                        Uninstall
                      </button>
                    )}
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--anchoran-text-secondary)", marginLeft: 4 }}>
                      <input
                        key={autoUpdateVersion}
                        type="checkbox"
                        checked={isAutoUpdateEnabled(selectedPlugin.id)}
                        onChange={(e) => {
                          setAutoUpdateEnabled(selectedPlugin.id, e.target.checked);
                          setAutoUpdateVersion((v) => v + 1);
                        }}
                      />
                      Auto-update
                    </label>
                  </>
                ) : (
                  <button
                    className="app-toolbar-btn"
                    disabled={pluginBusy === selectedPlugin.id}
                    onClick={() => onInstallPlugin(selectedPlugin)}
                  >
                    {pluginBusy === selectedPlugin.id ? "Installing…" : "Install"}
                  </button>
                )}
              </div>
              <p className="webstore-detail-description">{selectedPlugin.description}</p>
              {selectedPlugin.recentChanges && selectedPlugin.recentChanges.length > 0 && (
                <div style={{ margin: "0 0 16px" }}>
                  <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.06, color: "var(--anchoran-text-secondary)", marginBottom: 6 }}>
                    Recent changes
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[...selectedPlugin.recentChanges]
                      .reverse()
                      .map((entry) => (
                        <div key={entry.version} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                          <span style={{ fontFamily: "Cascadia Code, Consolas, monospace", fontWeight: 600 }}>v{entry.version}</span>
                          <span style={{ color: "var(--anchoran-text-secondary)" }}> — {entry.notes}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="webstore-grid">
              {filteredPlugins.map((plugin) => {
                const isInstalled = installedPlugins.has(plugin.id);
                return (
                  <div className="webstore-card" key={plugin.id} onClick={() => setSelectedPlugin(plugin)}>
                    <IconTile name={plugin.icon as IconName} size={40} glyphScale={0.5} />
                    <div className="webstore-card-body">
                      <div className="webstore-card-title">{plugin.title}</div>
                      <div className="webstore-card-desc">{plugin.description}</div>
                      <div className="webstore-card-author">by {plugin.author ?? "Unknown"}</div>
                    </div>
                    <button
                      className="app-toolbar-btn"
                      disabled={pluginBusy === plugin.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isInstalled) openApp("pluginHost", { pluginId: plugin.id, title: plugin.title });
                        else onInstallPlugin(plugin);
                      }}
                    >
                      {pluginBusy === plugin.id ? "Installing…" : isInstalled ? "Open" : "Install"}
                    </button>
                  </div>
                );
              })}
              {plugins.length === 0 && (
                <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 13, padding: 20 }}>
                  Couldn't reach the Anchoran Webstore's community catalog — check your connection.
                </div>
              )}
              {plugins.length > 0 && filteredPlugins.length === 0 && (
                <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 13, padding: 20 }}>No apps found.</div>
              )}
            </div>
          )
        ) : (
          <div className="webstore-grid">
            {creations.map((creation) => (
              <div className="webstore-card" key={creation.id} onClick={() => openCreation(creation)}>
                {creation.icon ? (
                  <img src={creation.icon} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <IconTile name="jsonFormatter" size={40} glyphScale={0.5} />
                )}
                <div className="webstore-card-body">
                  <div className="webstore-card-title">{creation.name}</div>
                  <div className="webstore-card-desc">{creation.description || "No description yet."}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    className="app-toolbar-btn"
                    aria-label={`Edit ${creation.name} in Code Studio`}
                    title="Edit in Code Studio"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCreation(creation);
                    }}
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    className="app-toolbar-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCreation(creation);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {creations.length === 0 && (
              <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 13, padding: 20 }}>
                Nothing here yet — build your own local app in Anchoran Code Studio (Community) and it shows up here.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
