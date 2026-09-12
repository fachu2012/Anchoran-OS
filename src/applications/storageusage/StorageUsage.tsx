import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./storageusage.css";

interface Drive {
  caption: string;
  free: number;
  total: number;
}

interface FolderSize {
  label: string;
  path: string;
  size: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function StorageUsageApp() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [folders, setFolders] = useState<FolderSize[] | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [cleaning, setCleaning] = useState<"recycleBin" | "cache" | null>(null);
  const pushNotification = useNotificationStore((s) => s.push);

  function refresh() {
    if (!window.anchoran) return;
    window.anchoran.getDiskUsage().then((r) => setDrives(r.drives));

    window.anchoran.fsSpecialFolders().then(async (special) => {
      const targets = [
        { label: "Desktop", path: special.desktop },
        { label: "Documents", path: special.documents },
        { label: "Downloads", path: special.downloads },
        { label: "Pictures", path: special.pictures },
        { label: "Music", path: special.music },
        { label: "Videos", path: special.videos },
      ];
      const sizes = await window.anchoran!.getFolderSizes(targets);
      setFolders(sizes.sort((a, b) => b.size - a.size));
      setLoadingFolders(false);
    });
  }

  useEffect(refresh, []);

  async function emptyRecycleBin() {
    if (!window.anchoran) return;
    setCleaning("recycleBin");
    const result = await window.anchoran.emptyRecycleBin();
    setCleaning(null);
    pushNotification("Storage Usage", result.success ? "Recycle Bin emptied." : result.error ?? "Couldn't empty the Recycle Bin.");
    refresh();
  }

  async function clearCache() {
    if (!window.anchoran) return;
    setCleaning("cache");
    const result = await window.anchoran.clearCache();
    setCleaning(null);
    pushNotification(
      "Storage Usage",
      result.success ? `Cleared ${formatBytes(result.freedBytes ?? 0)} of Anchoran's cache.` : result.error ?? "Couldn't clear the cache."
    );
    refresh();
  }

  const maxFolderSize = folders && folders.length > 0 ? Math.max(...folders.map((f) => f.size), 1) : 1;

  return (
    <div className="app-root">
      <div className="app-content storageusage-content">
        <div className="storageusage-section-title">Quick cleanup</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className="app-toolbar-btn" onClick={emptyRecycleBin} disabled={cleaning !== null}>
            <Icon name="recycleBin" size={13} /> {cleaning === "recycleBin" ? "Emptying…" : "Empty Recycle Bin"}
          </button>
          <button className="app-toolbar-btn" onClick={clearCache} disabled={cleaning !== null}>
            {cleaning === "cache" ? "Clearing…" : "Clear Anchoran cache"}
          </button>
        </div>

        <div className="storageusage-section-title">Drives</div>
        {drives.length === 0 && (
          <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>
            Drive information is only available inside the Anchoran desktop app.
          </div>
        )}
        {drives.map((d) => {
          const used = d.total - d.free;
          const pct = d.total > 0 ? Math.round((used / d.total) * 100) : 0;
          return (
            <div key={d.caption} className="sysmon-card" style={{ marginBottom: 10 }}>
              <div className="sysmon-card-label">{d.caption}</div>
              <div className="sysmon-card-value">
                {formatBytes(used)} used of {formatBytes(d.total)}
              </div>
              <div className="sysmon-meter">
                <div className="sysmon-meter-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}

        <div className="storageusage-section-title" style={{ marginTop: 16 }}>
          Your folders
        </div>
        {loadingFolders && (
          <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>Calculating…</div>
        )}
        {folders?.map((f) => (
          <div key={f.path} className="storageusage-row">
            <Icon name="folder" size={16} />
            <span className="storageusage-label">{f.label}</span>
            <div className="storageusage-bar">
              <div className="storageusage-bar-fill" style={{ width: `${(f.size / maxFolderSize) * 100}%` }} />
            </div>
            <span className="storageusage-size">{formatBytes(f.size)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
