import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import "./filepicker.css";

type Mode = "open" | "save" | "folder";

interface QuickLink {
  key: keyof Awaited<ReturnType<NonNullable<typeof window.anchoran>["fsSpecialFolders"]>>;
  label: string;
}

const QUICK_LINKS: QuickLink[] = [
  { key: "desktop", label: "Desktop" },
  { key: "documents", label: "Documents" },
  { key: "downloads", label: "Downloads" },
  { key: "pictures", label: "Pictures" },
  { key: "music", label: "Music" },
  { key: "videos", label: "Videos" },
];

/** "C:\Users" -> "C:\", "C:\Users\me" -> "C:\Users", "C:\" -> null (already at a drive root). */
function parentPath(p: string): string | null {
  const trimmed = p.replace(/[\\/]+$/, "");
  const idx = trimmed.lastIndexOf("\\");
  if (idx < 0) return null;
  const parent = trimmed.slice(0, idx);
  return parent.length <= 2 ? `${parent}\\` : parent;
}

/**
 * Anchoran's own file/folder picker — a lightweight version of Files'
 * own navigation, used anywhere the OS needs the user to point at a
 * real file or folder (importing a photo, choosing where to save,
 * exporting a zip, …) instead of ever falling back to Windows' native
 * Explorer-backed picker dialogs. Everything it shows comes from the
 * same real filesystem IPC Files itself uses.
 */
export function AnchoranFilePicker({
  mode,
  title,
  extensions,
  defaultName,
  startPath,
  onConfirm,
  onCancel,
}: {
  mode: Mode;
  title: string;
  /** Lowercase extensions with the dot, e.g. [".png", ".jpg"]. Only relevant for "open". Omit to allow any file. */
  extensions?: string[];
  /** Only relevant for "save". */
  defaultName?: string;
  startPath?: string;
  onConfirm: (result: { path: string } | { dir: string; name: string }) => void;
  onCancel: () => void;
}) {
  const [quickLinks, setQuickLinks] = useState<Record<string, string> | null>(null);
  const [drives, setDrives] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FsEntry[] | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [saveName, setSaveName] = useState(defaultName ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.anchoran) return;
    Promise.all([window.anchoran.fsSpecialFolders(), window.anchoran.fsListDrives()]).then(
      ([folders, driveList]) => {
        setQuickLinks(folders);
        setDrives(driveList);
        const start = startPath ?? folders.documents;
        setCurrentPath(start);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentPath || !window.anchoran) return;
    setSelectedFile(null);
    setError(null);
    window.anchoran.fsListDir(currentPath).then((result) => {
      if ("error" in result) {
        setError(result.error);
        setEntries([]);
      } else {
        setEntries(result.entries);
      }
    });
  }, [currentPath]);

  function goToThisPC() {
    setCurrentPath(null);
    setEntries(null);
    setSelectedFile(null);
    setError(null);
  }

  function goUp() {
    if (!currentPath) return;
    const parent = parentPath(currentPath);
    if (parent) setCurrentPath(parent);
    else goToThisPC();
  }

  const visibleEntries = (entries ?? [])
    .filter((e) => e.isDirectory || mode !== "folder")
    .filter((e) => {
      if (e.isDirectory || !extensions || extensions.length === 0) return true;
      const ext = e.name.slice(e.name.lastIndexOf(".")).toLowerCase();
      return extensions.includes(ext);
    })
    // Newest first by default, matching Files' own default sort —
    // folders still group ahead of files either way.
    .sort((a, b) => (a.isDirectory === b.isDirectory ? b.modifiedAt - a.modifiedAt : a.isDirectory ? -1 : 1));

  function openEntry(entry: FsEntry) {
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
      return;
    }
    if (mode === "open") {
      setSelectedFile(entry.path);
    }
  }

  function confirmDoubleClick(entry: FsEntry) {
    if (!entry.isDirectory && mode === "open") onConfirm({ path: entry.path });
  }

  function confirm() {
    if (mode === "open" && selectedFile) onConfirm({ path: selectedFile });
    else if (mode === "folder" && currentPath) onConfirm({ path: currentPath });
    else if (mode === "save" && currentPath && saveName.trim()) onConfirm({ dir: currentPath, name: saveName.trim() });
  }

  const canConfirm =
    (mode === "open" && !!selectedFile) ||
    (mode === "folder" && !!currentPath) ||
    (mode === "save" && !!currentPath && saveName.trim().length > 0);

  return (
    <div
      className="filepicker-backdrop"
      onClick={onCancel}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="filepicker-panel" onClick={(e) => e.stopPropagation()}>
        <div className="filepicker-header">
          <span>{title}</span>
          <button className="filepicker-close" onClick={onCancel} aria-label="Cancel">
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="filepicker-body">
          <div className="filepicker-sidebar">
            <button className="filepicker-side-item" data-active={currentPath === null} onClick={goToThisPC}>
              <Icon name="storageUsage" size={14} /> This PC
            </button>
            {quickLinks &&
              QUICK_LINKS.map((q) => (
                <button
                  key={q.key}
                  className="filepicker-side-item"
                  data-active={currentPath === quickLinks[q.key]}
                  onClick={() => setCurrentPath(quickLinks[q.key])}
                >
                  <Icon name="folder" size={14} /> {q.label}
                </button>
              ))}
          </div>
          <div className="filepicker-main">
            <div className="filepicker-toolbar">
              <button className="filepicker-up" onClick={goUp} disabled={!currentPath} aria-label="Up one level">
                <Icon name="chevronRight" size={13} style={{ transform: "rotate(-90deg)" }} />
              </button>
              <span className="filepicker-path">{currentPath ?? "This PC"}</span>
            </div>
            <div className="filepicker-list">
              {currentPath === null &&
                drives.map((d) => (
                  <div key={d} className="filepicker-row" onClick={() => setCurrentPath(d)}>
                    <Icon name="storageUsage" size={15} />
                    <span>{d}</span>
                  </div>
                ))}
              {error && <div className="filepicker-error">{error}</div>}
              {currentPath !== null &&
                !error &&
                visibleEntries.map((entry) => (
                  <div
                    key={entry.path}
                    className="filepicker-row"
                    data-selected={selectedFile === entry.path}
                    onClick={() => openEntry(entry)}
                    onDoubleClick={() => confirmDoubleClick(entry)}
                  >
                    <Icon name={entry.isDirectory ? "folder" : "file"} size={15} />
                    <span>{entry.name}</span>
                  </div>
                ))}
              {currentPath !== null && !error && visibleEntries.length === 0 && (
                <div className="filepicker-empty">This folder is empty.</div>
              )}
            </div>
            {mode === "save" && (
              <div className="filepicker-savebar">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canConfirm && confirm()}
                  placeholder="File name"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>
        <div className="filepicker-footer">
          <button className="app-toolbar-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="app-toolbar-btn" data-op disabled={!canConfirm} onClick={confirm}>
            {mode === "open" ? "Open" : mode === "save" ? "Save" : "Select folder"}
          </button>
        </div>
      </div>
    </div>
  );
}
