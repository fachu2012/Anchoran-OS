import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { APP_LIST } from "@/applications/registry";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useTaskbarStore } from "@/desktop/taskbarStore";
import { useInstalledAppsStore } from "@/applications/installedAppsStore";
import "./launcher.css";

// Mirrors Settings.tsx's SECTIONS — kept here as a plain list rather
// than deep-linking into a specific tab (Settings has no "open to this
// section" entry point yet), so a match just opens Settings and the
// user picks the tab themselves, one click in.
const SETTINGS_SECTIONS = [
  "Appearance", "Personalization", "Display", "Sound", "Network", "Notifications",
  "Users", "Privacy", "System", "Shortcuts", "System Mode", "Updater",
];

interface FileResult {
  name: string;
  path: string;
  isDirectory: boolean;
}

async function searchFiles(query: string): Promise<FileResult[]> {
  if (!window.anchoran || query.length < 2) return [];
  const folders = await window.anchoran.fsSpecialFolders();
  const roots = [folders.desktop, folders.documents, folders.downloads, folders.pictures];
  const results: FileResult[] = [];
  const lowerQuery = query.toLowerCase();

  async function scan(dir: string, depth: number) {
    if (results.length >= 20 || depth > 3) return;
    const result = await window.anchoran!.fsListDir(dir);
    if ("error" in result) return;
    for (const entry of result.entries) {
      if (results.length >= 20) return;
      if (entry.name.toLowerCase().includes(lowerQuery)) {
        results.push({ name: entry.name, path: entry.path, isDirectory: entry.isDirectory });
      }
      if (entry.isDirectory) await scan(entry.path, depth + 1);
    }
  }

  for (const root of roots) {
    if (results.length >= 20) break;
    await scan(root, 0);
  }
  return results;
}

export function Launcher({ onClose, onPower }: { onClose: () => void; onPower: () => void }) {
  const [query, setQuery] = useState("");
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const openApp = useWindowStore((s) => s.openApp);
  const pinned = useTaskbarStore((s) => s.pinned);
  const pin = useTaskbarStore((s) => s.pin);
  const unpin = useTaskbarStore((s) => s.unpin);
  const installed = useInstalledAppsStore((s) => s.installed);

  // The Launcher is a list of apps you can actually open — like any
  // real OS, that means installed apps only. Anchoran Webstore is
  // where you browse and install the rest.
  const installedApps = useMemo(() => APP_LIST.filter((a) => installed.has(a.id)), [installed]);

  const appResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return installedApps;
    return installedApps.filter((a) => a.title.toLowerCase().includes(q));
  }, [installedApps, query]);

  const settingResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SETTINGS_SECTIONS.filter((s) => s.toLowerCase().includes(q));
  }, [query]);

  // Real files are read from disk, so this is debounced rather than
  // searched on every keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFileResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const files = await searchFiles(q);
      if (!cancelled) setFileResults(files);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function launch(appId: (typeof APP_LIST)[number]["id"]) {
    openApp(appId);
    onClose();
  }

  function openSettingSection() {
    openApp("settings");
    onClose();
  }

  async function openFileResult(file: FileResult) {
    if (file.isDirectory) {
      openApp("files");
      onClose();
      return;
    }
    const result = await window.anchoran!.fsOpenPath(file.path);
    if (result.success) onClose();
  }

  const hasQuery = query.trim().length > 0;

  return (
    <div className="launcher-backdrop" onClick={onClose}>
      <div className="launcher-panel" onClick={(e) => e.stopPropagation()}>
        <div className="launcher-search">
          <Icon name="search" size={18} />
          <input
            autoFocus
            placeholder="Search apps, files and settings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && appResults[0]) launch(appResults[0].id);
              if (e.key === "Escape") onClose();
            }}
          />
        </div>
        <div className="launcher-results">
          {appResults.map((app, i) => {
            const isPinned = pinned.includes(app.id);
            return (
              <div key={app.id} className="launcher-item" data-active={i === 0}>
                <button className="launcher-item-main" onClick={() => launch(app.id)}>
                  <span className="launcher-item-icon">
                    <Icon name={app.icon as IconName} size={18} />
                  </span>
                  {app.title}
                  {i === 0 && <span className="launcher-item-hint">↵</span>}
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

          {hasQuery && settingResults.length > 0 && (
            <>
              <div className="launcher-section-label">Settings</div>
              {settingResults.map((s) => (
                <div key={s} className="launcher-item">
                  <button className="launcher-item-main" onClick={openSettingSection}>
                    <span className="launcher-item-icon">
                      <Icon name="settings" size={18} />
                    </span>
                    {s}
                  </button>
                </div>
              ))}
            </>
          )}

          {hasQuery && fileResults.length > 0 && (
            <>
              <div className="launcher-section-label">Files</div>
              {fileResults.map((f) => (
                <div key={f.path} className="launcher-item">
                  <button className="launcher-item-main" onClick={() => openFileResult(f)}>
                    <span className="launcher-item-icon">
                      <Icon name={f.isDirectory ? "folder" : "file"} size={18} />
                    </span>
                    {f.name}
                  </button>
                </div>
              ))}
            </>
          )}

          {hasQuery && appResults.length === 0 && settingResults.length === 0 && fileResults.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: "var(--anchoran-text-secondary)" }}>No results.</div>
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
