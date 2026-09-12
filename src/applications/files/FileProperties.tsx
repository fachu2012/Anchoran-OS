import { useEffect, useState } from "react";
import { IconTile } from "@/components/IconTile";
import { iconForFile, typeLabelForFile } from "./fileTypes";

interface Entry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
  createdAt: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--anchoran-border)" }}>
      <span style={{ width: 90, flexShrink: 0, color: "var(--anchoran-text-secondary)", fontSize: 12 }}>{label}</span>
      <span style={{ fontSize: 12.5, wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

/** A real Properties dialog — size (recursively computed for folders), location, and real creation/modification dates from the filesystem. */
export function FileProperties({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const [folderSize, setFolderSize] = useState<number | null>(null);

  useEffect(() => {
    if (!entry.isDirectory || !window.anchoran) return;
    let cancelled = false;
    window.anchoran.getFolderSizes([{ label: entry.name, path: entry.path }]).then((sizes) => {
      if (!cancelled && sizes[0]) setFolderSize(sizes[0].size);
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const location = entry.path.slice(0, entry.path.length - entry.name.length - 1) || entry.path;
  const sizeText = entry.isDirectory
    ? folderSize === null
      ? "Calculating…"
      : formatBytes(folderSize)
    : formatBytes(entry.size);

  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 55, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(90%, 420px)",
          background: "var(--anchoran-surface)",
          borderRadius: "var(--anchoran-radius-lg)",
          boxShadow: "var(--anchoran-shadow-window)",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <IconTile name={entry.isDirectory ? "folder" : iconForFile(entry.name)} size={30} glyphScale={0.56} />
          <span style={{ fontSize: 14, fontWeight: 500, wordBreak: "break-all" }}>{entry.name}</span>
        </div>
        <Row label="Type" value={entry.isDirectory ? "Folder" : typeLabelForFile(entry.name)} />
        <Row label="Location" value={location} />
        <Row label="Size" value={sizeText} />
        <Row label="Created" value={formatDate(entry.createdAt)} />
        <Row label="Modified" value={formatDate(entry.modifiedAt)} />
        <button
          className="app-toolbar-btn"
          onClick={onClose}
          style={{ marginTop: 14, width: "100%", justifyContent: "center" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
