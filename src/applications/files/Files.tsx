import { useEffect, useState, type DragEvent } from "react";
import { Icon } from "@/components/Icon";
import { useNotificationStore } from "@/notifications/notificationStore";
import { ContextMenu, type ContextMenuItem } from "@/desktop/ContextMenu";
import { printTextAsPdf } from "@/core/print";
import "@/applications/apps.css";

const THIS_PC = "This PC";
type Entry = { name: string; path: string; isDirectory: boolean; size: number; modifiedAt: number };
type Clipboard = { paths: string[]; mode: "copy" | "cut" } | null;

function parentOf(p: string): string {
  const trimmed = p.replace(/[\\/]+$/, "");
  const idx = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
  if (idx <= 2) return THIS_PC; // "C:\" or shorter -> back to This PC
  return trimmed.slice(0, idx);
}

function formatSize(bytes: number, isDir: boolean) {
  if (isDir) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a"]);
const VIDEO_EXT = new Set([".mp4", ".webm"]);

export function FilesApp() {
  const [currentPath, setCurrentPath] = useState<string>(THIS_PC);
  const [quickLinks, setQuickLinks] = useState<{ label: string; path: string }[]>([]);
  const [drives, setDrives] = useState<string[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<Clipboard>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; entry: Entry | null } | null>(null);
  const [openFile, setOpenFile] = useState<{ path: string; name: string; content: string; isImage: boolean; dataUrl?: string } | null>(null);
  const pushNotification = useNotificationStore((s) => s.push);

  useEffect(() => {
    if (!window.anchoran) return;
    window.anchoran.fsSpecialFolders().then((folders) => {
      setQuickLinks([
        { label: "Desktop", path: folders.desktop },
        { label: "Documents", path: folders.documents },
        { label: "Downloads", path: folders.downloads },
        { label: "Pictures", path: folders.pictures },
        { label: "Music", path: folders.music },
        { label: "Videos", path: folders.videos },
      ]);
    });
    window.anchoran.fsListDrives().then(setDrives);
  }, []);

  async function load(dirPath: string) {
    if (!window.anchoran || dirPath === THIS_PC) {
      setEntries([]);
      setLoadError(null);
      return;
    }
    const result = await window.anchoran.fsListDir(dirPath);
    if ("error" in result) {
      setLoadError(result.error);
      setEntries([]);
    } else {
      setLoadError(null);
      setEntries(
        [...result.entries].sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1))
      );
    }
  }

  useEffect(() => {
    load(currentPath);
    setSelected(new Set());
    setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  function refresh() {
    load(currentPath);
  }

  async function openEntry(entry: Entry) {
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
      return;
    }
    const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
    if (IMAGE_EXT.has(ext)) {
      const result = await window.anchoran!.fsReadImageFile(entry.path);
      if ("dataUrl" in result) {
        setOpenFile({ path: entry.path, name: entry.name, content: "", isImage: true, dataUrl: result.dataUrl });
      } else {
        pushNotification("Files", result.error);
      }
      return;
    }
    const isText = await window.anchoran!.fsIsTextFile(entry.path);
    if (isText) {
      const result = await window.anchoran!.fsReadTextFile(entry.path);
      if ("content" in result) {
        setOpenFile({ path: entry.path, name: entry.name, content: result.content, isImage: false });
      } else {
        pushNotification("Files", result.error);
      }
      return;
    }
    // Anchoran 2.0.0 only natively opens images and text files — any
    // other extension is "not supported yet" rather than silently
    // handing it off to whatever Windows happens to use for it.
    // Right-click → Open with… stays available as the explicit,
    // deliberate way to launch a real Windows app for it instead.
    if (AUDIO_EXT.has(ext) || VIDEO_EXT.has(ext)) {
      pushNotification("Files", `${entry.name} isn't previewed in Files — open it in Media Player, or right-click → Open with…`);
    } else {
      pushNotification("Files", `${entry.name} isn't a file type Anchoran supports yet. Right-click → Open with… to open it with a Windows app.`);
    }
  }

  async function saveOpenFile(content: string) {
    if (!openFile) return;
    setOpenFile({ ...openFile, content });
    const result = await window.anchoran!.fsWriteTextFile(openFile.path, content);
    if (!("success" in result) || !result.success) {
      pushNotification("Files", "error" in result ? result.error! : "Couldn't save.");
    }
  }

  async function newFolder() {
    if (!window.anchoran || currentPath === THIS_PC) return;
    const result = await window.anchoran.fsCreateFolder(currentPath, "New Folder");
    if ("error" in result) pushNotification("Files", result.error);
    else refresh();
  }

  async function newFile() {
    if (!window.anchoran || currentPath === THIS_PC) return;
    const result = await window.anchoran.fsCreateFile(currentPath, "New File.txt", "");
    if ("error" in result) pushNotification("Files", result.error);
    else refresh();
  }

  function startRename(entry: Entry) {
    setRenamingPath(entry.path);
    setRenameValue(entry.name);
  }

  async function commitRename() {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    const result = await window.anchoran!.fsRename(renamingPath, renameValue.trim());
    if ("error" in result) pushNotification("Files", result.error);
    setRenamingPath(null);
    refresh();
  }

  async function deletePaths(paths: string[]) {
    const result = await window.anchoran!.fsDelete(paths);
    if (!result.success) pushNotification("Files", result.error ?? "Couldn't delete.");
    setSelected(new Set());
    refresh();
  }

  async function pasteClipboard() {
    if (!clipboard || currentPath === THIS_PC) return;
    const result = clipboard.mode === "copy"
      ? await window.anchoran!.fsCopy(clipboard.paths, currentPath)
      : await window.anchoran!.fsMove(clipboard.paths, currentPath);
    if (!result.success) pushNotification("Files", result.error ?? "Couldn't paste.");
    if (clipboard.mode === "cut") setClipboard(null);
    refresh();
  }

  async function onDrop(e: DragEvent, targetDir: string) {
    e.preventDefault();
    if (e.dataTransfer.files.length === 0) return;
    const paths = Array.from(e.dataTransfer.files).map((f) => (f as File & { path?: string }).path).filter(Boolean) as string[];
    if (paths.length === 0) return;
    await window.anchoran!.fsCopy(paths, targetDir);
    refresh();
  }

  function toggleSelect(path: string, e: React.MouseEvent) {
    setSelected((prev) => {
      const next = new Set(e.ctrlKey || e.metaKey ? prev : []);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (openFile || renamingPath) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "c" && selected.size > 0) {
        setClipboard({ paths: Array.from(selected), mode: "copy" });
      } else if (mod && e.key.toLowerCase() === "x" && selected.size > 0) {
        setClipboard({ paths: Array.from(selected), mode: "cut" });
      } else if (mod && e.key.toLowerCase() === "v" && clipboard) {
        pasteClipboard();
      } else if (e.key === "Delete" && selected.size > 0) {
        deletePaths(Array.from(selected));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, clipboard, openFile, renamingPath, currentPath]);

  function entryMenuItems(entry: Entry): ContextMenuItem[] {
    const paths = selected.has(entry.path) && selected.size > 1 ? Array.from(selected) : [entry.path];
    return [
      { label: "Open", onSelect: () => openEntry(entry) },
      ...(!entry.isDirectory ? [{ label: "Open with…", onSelect: () => window.anchoran!.fsOpenWith(entry.path) }] : []),
      { label: "Cut", onSelect: () => setClipboard({ paths, mode: "cut" }) },
      { label: "Copy", onSelect: () => setClipboard({ paths, mode: "copy" }) },
      ...(paths.length === 1 ? [{ label: "Rename", onSelect: () => startRename(entry) }] : []),
      { label: "Show in Explorer", onSelect: () => window.anchoran!.fsShowInExplorer(entry.path) },
      { label: paths.length > 1 ? `Delete ${paths.length} items` : "Delete", onSelect: () => deletePaths(paths) },
    ];
  }

  function emptySpaceMenuItems(): ContextMenuItem[] {
    if (currentPath === THIS_PC) return [];
    const items: ContextMenuItem[] = [
      { label: "New Folder", onSelect: newFolder },
      { label: "New File", onSelect: newFile },
    ];
    if (clipboard) items.push({ label: "Paste", onSelect: pasteClipboard });
    return items;
  }

  const filtered = query.trim() ? entries.filter((e) => e.name.toLowerCase().includes(query.toLowerCase())) : entries;

  if (openFile) {
    return (
      <div className="app-root">
        <div className="app-toolbar">
          <button className="app-toolbar-btn" onClick={() => setOpenFile(null)}>
            <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} /> Back
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{openFile.name}</span>
          {!openFile.isImage && (
            <button className="app-toolbar-btn" onClick={() => printTextAsPdf(openFile.name.replace(/\.[^.]+$/, ""), openFile.content)}>
              Print
            </button>
          )}
        </div>
        <div className="app-content" style={{ padding: 0 }}>
          {openFile.isImage ? (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
              <img src={openFile.dataUrl} alt={openFile.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            </div>
          ) : (
            <textarea
              value={openFile.content}
              onChange={(e) => saveOpenFile(e.target.value)}
              style={{
                width: "100%", height: "100%", padding: 16, border: "none", outline: "none", resize: "none",
                background: "transparent", color: "var(--anchoran-text-primary)", fontFamily: "inherit", fontSize: 14, lineHeight: 1.6,
              }}
              autoFocus
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={() => setCurrentPath(THIS_PC)} data-op={currentPath === THIS_PC}>
          This PC
        </button>
        <button className="app-toolbar-btn" onClick={() => setCurrentPath(parentOf(currentPath))} disabled={currentPath === THIS_PC}>
          <Icon name="chevronRight" size={13} style={{ transform: "rotate(180deg)" }} />
        </button>
        <button className="app-toolbar-btn" onClick={newFolder} disabled={currentPath === THIS_PC}>
          <Icon name="folder" size={14} /> New Folder
        </button>
        <button className="app-toolbar-btn" onClick={newFile} disabled={currentPath === THIS_PC}>
          <Icon name="file" size={14} /> New File
        </button>
        <input
          placeholder="Filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ border: "1px solid var(--anchoran-border)", borderRadius: 6, padding: "5px 9px", background: "var(--anchoran-bg)", color: "var(--anchoran-text-primary)", fontSize: 12.5, width: 140 }}
        />
        <button className="app-toolbar-btn" onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))} style={{ marginLeft: "auto" }}>
          {viewMode === "grid" ? "List view" : "Grid view"}
        </button>
        {currentPath !== THIS_PC && <span className="files-path">{currentPath}</span>}
      </div>
      <div
        className="app-content"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => currentPath !== THIS_PC && onDrop(e, currentPath)}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, entry: null });
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected(new Set());
        }}
      >
        {currentPath === THIS_PC ? (
          <div className="files-grid">
            {quickLinks.map((q) => (
              <div key={q.path} className="files-item" onDoubleClick={() => setCurrentPath(q.path)} onClick={() => setCurrentPath(q.path)}>
                <Icon name="folder" size={30} />
                <span>{q.label}</span>
              </div>
            ))}
            {drives.map((d) => (
              <div key={d} className="files-item" onDoubleClick={() => setCurrentPath(d)} onClick={() => setCurrentPath(d)}>
                <Icon name="files" size={30} />
                <span>{d}</span>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div style={{ color: "#E5484D", fontSize: 13, padding: 12 }}>{loadError}</div>
        ) : viewMode === "grid" ? (
          <div className="files-grid">
            {filtered.map((entry) => (
              <div
                key={entry.path}
                className="files-item"
                data-selected={selected.has(entry.path)}
                data-cut={clipboard?.mode === "cut" && clipboard.paths.includes(entry.path)}
                draggable
                onClick={(e) => toggleSelect(entry.path, e)}
                onDoubleClick={() => openEntry(entry)}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", entry.path)}
                onDragOver={(e) => entry.isDirectory && e.preventDefault()}
                onDrop={(e) => entry.isDirectory && onDrop(e, entry.path)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!selected.has(entry.path)) setSelected(new Set([entry.path]));
                  setMenu({ x: e.clientX, y: e.clientY, entry });
                }}
              >
                <Icon name={entry.isDirectory ? "folder" : "file"} size={30} />
                {renamingPath === entry.path ? (
                  <input
                    autoFocus
                    className="files-rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={commitRename}
                    onKeyDown={(e) => e.key === "Enter" && commitRename()}
                  />
                ) : (
                  <span onDoubleClick={(e) => (e.stopPropagation(), startRename(entry))}>{entry.name}</span>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <span style={{ color: "var(--anchoran-text-secondary)", fontSize: 13 }}>
                {query ? "No results." : "This folder is empty."}
              </span>
            )}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--anchoran-text-secondary)" }}>
                <th style={{ fontWeight: 500, padding: "6px 8px" }}>Name</th>
                <th style={{ fontWeight: 500, padding: "6px 8px" }}>Size</th>
                <th style={{ fontWeight: 500, padding: "6px 8px" }}>Modified</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr
                  key={entry.path}
                  data-selected={selected.has(entry.path)}
                  onClick={(e) => toggleSelect(entry.path, e)}
                  onDoubleClick={() => openEntry(entry)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!selected.has(entry.path)) setSelected(new Set([entry.path]));
                    setMenu({ x: e.clientX, y: e.clientY, entry });
                  }}
                  style={{ cursor: "default", borderTop: "1px solid var(--anchoran-border)" }}
                >
                  <td style={{ padding: "7px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name={entry.isDirectory ? "folder" : "file"} size={15} />
                    {entry.name}
                  </td>
                  <td style={{ padding: "7px 8px", color: "var(--anchoran-text-secondary)" }}>{formatSize(entry.size, entry.isDirectory)}</td>
                  <td style={{ padding: "7px 8px", color: "var(--anchoran-text-secondary)" }}>{formatDate(entry.modifiedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.entry ? entryMenuItems(menu.entry) : emptySpaceMenuItems()} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
