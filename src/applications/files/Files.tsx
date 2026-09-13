import { useEffect, useState, type DragEvent } from "react";
import { Icon } from "@/components/Icon";
import { IconTile } from "@/components/IconTile";
import { useNotificationStore } from "@/notifications/notificationStore";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useDefaultAppsStore } from "@/core/defaultAppsStore";
import { ContextMenu, type ContextMenuEntry } from "@/desktop/ContextMenu";
import { QuickLook } from "./QuickLook";
import { FileProperties } from "./FileProperties";
import { iconForFile } from "./fileTypes";
import JSZip from "jszip";
import { addPathToZip, extractZipTo } from "@/core/zipHelpers";
import "@/applications/apps.css";

const THIS_PC = "This PC";
type Entry = { name: string; path: string; isDirectory: boolean; size: number; modifiedAt: number; createdAt: number };
type Clipboard = { paths: string[]; mode: "copy" | "cut" } | null;
type SortMode = "name-asc" | "name-desc" | "date-desc" | "date-asc" | "size-desc" | "size-asc";

const SORT_LABELS: Record<SortMode, string> = {
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
  "size-desc": "Largest first",
  "size-asc": "Smallest first",
};

function compareEntries(a: Entry, b: Entry, mode: SortMode): number {
  switch (mode) {
    case "name-asc":
      return a.name.localeCompare(b.name);
    case "name-desc":
      return b.name.localeCompare(a.name);
    case "date-desc":
      return b.modifiedAt - a.modifiedAt;
    case "date-asc":
      return a.modifiedAt - b.modifiedAt;
    case "size-desc":
      return b.size - a.size;
    case "size-asc":
      return a.size - b.size;
  }
}

function parentOf(p: string): string {
  const trimmed = p.replace(/[\\/]+$/, "");
  // Already at a bare drive root ("C:") — one level up is This PC.
  if (/^[A-Za-z]:$/.test(trimmed)) return THIS_PC;
  const idx = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
  if (idx < 0) return THIS_PC;
  const parent = trimmed.slice(0, idx);
  // A parent of just "C:" is the drive root — keep its trailing
  // backslash so it lists that drive, not This PC directly (one more
  // "<" from there does land on This PC, via the check above).
  return /^[A-Za-z]:$/.test(parent) ? `${parent}\\` : parent;
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

// Functional sets — these gate real behavior (inline preview eligibility,
// the Media Player suggestion message) and must stay narrow, matching
// exactly what Anchoran can actually do with the file.
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".avi", ".mkv"]);

export function FilesApp() {
  const [currentPath, setCurrentPath] = useState<string>(THIS_PC);
  const [quickLinks, setQuickLinks] = useState<{ label: string; path: string }[]>([]);
  const [drives, setDrives] = useState<string[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [sortMode, setSortMode] = useState<SortMode>("date-desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<Clipboard>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; entry: Entry | null } | null>(null);
  const [quickLookEntry, setQuickLookEntry] = useState<Entry | null>(null);
  const [addressInput, setAddressInput] = useState("This PC");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [driveSpace, setDriveSpace] = useState<{ caption: string; free: number; total: number } | null>(null);
  const [includeSubfolders, setIncludeSubfolders] = useState(false);
  const [recursiveResults, setRecursiveResults] = useState<Entry[] | null>(null);
  const [propertiesEntry, setPropertiesEntry] = useState<Entry | null>(null);
  const [batchRenamePaths, setBatchRenamePaths] = useState<string[] | null>(null);
  const [batchPrefix, setBatchPrefix] = useState("");
  const [batchSuffix, setBatchSuffix] = useState("");
  const pushNotification = useNotificationStore((s) => s.push);
  const openApp = useWindowStore((s) => s.openApp);
  const defaultApps = useDefaultAppsStore();

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
    setAddressInput(currentPath);
    setAddressError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // A quick "how much room is left on this drive" readout — the same
  // thing a real file manager shows in its status bar.
  const currentDriveLetter = /^[A-Za-z]:/.test(currentPath) ? currentPath.slice(0, 2).toUpperCase() : null;
  useEffect(() => {
    if (!currentDriveLetter || !window.anchoran) {
      setDriveSpace(null);
      return;
    }
    let cancelled = false;
    window.anchoran.getDiskUsage().then((result) => {
      if (cancelled) return;
      const match = result.drives.find((d) => d.caption.toUpperCase() === currentDriveLetter);
      setDriveSpace(match ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [currentDriveLetter]);

  // "Include subfolders" search — a bounded recursive scan under the
  // current folder, debounced since it's real disk I/O rather than an
  // in-memory filter of what's already loaded.
  useEffect(() => {
    if (!includeSubfolders || !query.trim() || currentPath === THIS_PC || !window.anchoran) {
      setRecursiveResults(null);
      return;
    }
    let cancelled = false;
    const lowerQuery = query.trim().toLowerCase();
    const timer = setTimeout(async () => {
      const results: Entry[] = [];
      async function scan(dir: string, depth: number) {
        if (cancelled || results.length >= 300 || depth > 8) return;
        const result = await window.anchoran!.fsListDir(dir);
        if ("error" in result) return;
        for (const entry of result.entries) {
          if (cancelled || results.length >= 300) return;
          if (entry.name.toLowerCase().includes(lowerQuery)) results.push(entry);
          if (entry.isDirectory) await scan(entry.path, depth + 1);
        }
      }
      await scan(currentPath, 0);
      if (!cancelled) setRecursiveResults(results);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [includeSubfolders, query, currentPath]);

  async function goToAddress() {
    const target = addressInput.trim();
    if (!target || target.toLowerCase() === THIS_PC.toLowerCase()) {
      setCurrentPath(THIS_PC);
      return;
    }
    if (!window.anchoran) return;
    const result = await window.anchoran.fsListDir(target);
    if ("error" in result) {
      setAddressError(`"${target}" doesn't exist or can't be opened.`);
      return;
    }
    setAddressError(null);
    setCurrentPath(target);
  }

  function refresh() {
    load(currentPath);
  }

  // Opening a file hands it to whichever app is Anchoran's own
  // "default app" for that type — Photo Viewer for images, Notes for
  // text, Media Player for audio/video, Quick Look's archive view for
  // zips — the same way double-clicking a file in a real OS opens its
  // registered default app rather than staying inside the file
  // manager itself. Anything Anchoran has no app for falls through to
  // the file's real Windows default app, exactly like Explorer would.
  async function openEntry(entry: Entry) {
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
      return;
    }
    async function openExternally() {
      const result = await window.anchoran!.fsOpenPath(entry!.path);
      if (!result.success) pushNotification("Files", result.error ?? `Couldn't open ${entry!.name}.`);
    }

    const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
    if (IMAGE_EXT.has(ext)) {
      if (defaultApps.images === "external") await openExternally();
      else openApp("photoViewer", { openPath: entry.path });
      return;
    }
    if (ext === ".zip") {
      if (defaultApps.zip === "external") await openExternally();
      else setQuickLookEntry(entry);
      return;
    }
    if (AUDIO_EXT.has(ext) || VIDEO_EXT.has(ext)) {
      if (defaultApps.audioVideo === "external") await openExternally();
      else openApp("mediaPlayer", { openPath: entry.path });
      return;
    }
    const isText = await window.anchoran!.fsIsTextFile(entry.path);
    if (isText) {
      if (defaultApps.text === "external") await openExternally();
      else openApp("notes", { openPath: entry.path });
      return;
    }
    await openExternally();
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

  /** Adds a prefix and/or suffix to every selected item's name at once — the suffix lands before the extension for files, at the very end for folders. */
  async function batchRename(paths: string[], prefix: string, suffix: string) {
    if (!window.anchoran) return;
    let failures = 0;
    for (const path of paths) {
      const entry = entries.find((e) => e.path === path);
      if (!entry) continue;
      const dot = entry.isDirectory ? -1 : entry.name.lastIndexOf(".");
      const base = dot > 0 ? entry.name.slice(0, dot) : entry.name;
      const ext = dot > 0 ? entry.name.slice(dot) : "";
      const newName = `${prefix}${base}${suffix}${ext}`;
      const result = await window.anchoran.fsRename(path, newName);
      if ("error" in result) failures += 1;
    }
    if (failures > 0) pushNotification("Files", `${failures} item(s) couldn't be renamed.`);
    setSelected(new Set());
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

  /** "Compress to .zip" — the same native-Explorer convenience, built on the same JSZip logic Zip Tool uses. */
  async function compressPaths(paths: string[]) {
    if (currentPath === THIS_PC) return;
    pushNotification("Files", "Compressing…");
    const zip = new JSZip();
    for (const p of paths) {
      const entry = entries.find((e) => e.path === p);
      if (!entry) continue;
      await addPathToZip(zip, entry.path, entry.name, entry.isDirectory);
    }
    const base64 = await zip.generateAsync({ type: "base64" });
    const name = paths.length === 1 ? (entries.find((e) => e.path === paths[0])?.name ?? "Archive") : "Archive";
    const result = await window.anchoran!.fsWriteDataUrl(currentPath, `${name}.zip`, `data:application/zip;base64,${base64}`);
    if ("error" in result) pushNotification("Files", result.error);
    else pushNotification("Files", `Created ${name}.zip`);
    refresh();
  }

  /** "Extract here" — unpacks a .zip into a same-named subfolder of the current folder. */
  async function extractZip(entry: Entry) {
    const binResult = await window.anchoran!.fsReadBinary(entry.path);
    if ("error" in binResult) {
      pushNotification("Files", binResult.error);
      return;
    }
    try {
      const zip = await JSZip.loadAsync(binResult.base64, { base64: true });
      const folderName = entry.name.replace(/\.zip$/i, "");
      const result = await extractZipTo(zip, currentPath, folderName);
      if ("error" in result) pushNotification("Files", result.error);
      else pushNotification("Files", `Extracted to ${folderName}`);
      refresh();
    } catch {
      pushNotification("Files", "Couldn't read this archive.");
    }
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
      if (renamingPath || quickLookEntry) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "c" && selected.size > 0) {
        setClipboard({ paths: Array.from(selected), mode: "copy" });
      } else if (mod && e.key.toLowerCase() === "x" && selected.size > 0) {
        setClipboard({ paths: Array.from(selected), mode: "cut" });
      } else if (mod && e.key.toLowerCase() === "v" && clipboard) {
        pasteClipboard();
      } else if (e.key === "Delete" && selected.size > 0) {
        deletePaths(Array.from(selected));
      } else if (e.key === " " && selected.size === 1) {
        e.preventDefault();
        const entry = entries.find((en) => selected.has(en.path));
        if (entry && !entry.isDirectory) setQuickLookEntry(entry);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, clipboard, renamingPath, currentPath, quickLookEntry, entries]);

  function entryMenuItems(entry: Entry): ContextMenuEntry[] {
    const paths = selected.has(entry.path) && selected.size > 1 ? Array.from(selected) : [entry.path];
    return [
      { label: "Open", onSelect: () => openEntry(entry) },
      ...(!entry.isDirectory
        ? [
            { label: "Quick Look", onSelect: () => setQuickLookEntry(entry) },
            {
              label: "Open with…",
              onSelect: async () => {
                const result = await window.anchoran!.fsOpenWith(entry.path);
                if (!result.success) pushNotification("Files", result.error ?? "Couldn't open \"Open with\".");
              },
            },
          ]
        : []),
      ...(!entry.isDirectory && entry.name.toLowerCase().endsWith(".exe")
        ? [
            {
              label: "Run embedded in Anchoran (experimental)",
              onSelect: () => openApp("embeddedApp", { embedPath: entry.path, title: entry.name }),
            },
          ]
        : []),
      { label: "Cut", onSelect: () => setClipboard({ paths, mode: "cut" }) },
      { label: "Copy", onSelect: () => setClipboard({ paths, mode: "copy" }) },
      ...(paths.length === 1 ? [{ label: "Rename", onSelect: () => startRename(entry) }] : []),
      ...(paths.length > 1
        ? [{ label: `Batch rename ${paths.length} items…`, onSelect: () => setBatchRenamePaths(paths) }]
        : []),
      { label: "Compress to .zip", onSelect: () => compressPaths(paths) },
      ...(!entry.isDirectory && entry.name.toLowerCase().endsWith(".zip")
        ? [{ label: "Extract here", onSelect: () => extractZip(entry) }]
        : []),
      { label: "Show in Explorer", onSelect: () => window.anchoran!.fsShowInExplorer(entry.path) },
      { separator: true },
      { label: paths.length > 1 ? `Delete ${paths.length} items` : "Delete", onSelect: () => deletePaths(paths), danger: true },
      ...(paths.length === 1 ? [{ label: "Properties", onSelect: () => setPropertiesEntry(entry) }] : []),
    ];
  }

  function emptySpaceMenuItems(): ContextMenuEntry[] {
    if (currentPath === THIS_PC) return [];
    const items: ContextMenuEntry[] = [
      { label: "New Folder", onSelect: newFolder },
      { label: "New File", onSelect: newFile },
    ];
    if (clipboard) items.push({ label: "Paste", onSelect: pasteClipboard });
    return items;
  }

  const searchingSubfolders = includeSubfolders && query.trim().length > 0 && currentPath !== THIS_PC;
  const filtered = searchingSubfolders
    ? recursiveResults ?? []
    : query.trim()
      ? entries.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
      : entries;
  const sorted = [...filtered].sort((a, b) =>
    a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : compareEntries(a, b, sortMode)
  );

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
        <button
          className="app-toolbar-btn"
          data-op={includeSubfolders}
          onClick={() => setIncludeSubfolders((v) => !v)}
          disabled={currentPath === THIS_PC}
          title="Also search inside subfolders"
        >
          Subfolders
        </button>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          style={{ border: "1px solid var(--anchoran-border)", borderRadius: 6, padding: "5px 9px", background: "var(--anchoran-bg)", color: "var(--anchoran-text-primary)", fontSize: 12.5 }}
        >
          {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {SORT_LABELS[mode]}
            </option>
          ))}
        </select>
        <button className="app-toolbar-btn" onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))} style={{ marginLeft: "auto" }}>
          {viewMode === "grid" ? "List view" : "Grid view"}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid var(--anchoran-border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px" }}>
          <Icon name="folder" size={13} style={{ flexShrink: 0, color: "var(--anchoran-text-secondary)" }} />
          <input
            value={addressInput}
            onChange={(e) => {
              setAddressInput(e.target.value);
              setAddressError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && goToAddress()}
            placeholder="This PC"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--anchoran-text-primary)",
              fontSize: 12.5,
              fontFamily: "Cascadia Code, Consolas, monospace",
            }}
          />
        </div>
        {addressError && (
          <div style={{ padding: "0 14px 6px", fontSize: 11.5, color: "#E5484D" }}>{addressError}</div>
        )}
        {driveSpace && driveSpace.total > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px 7px" }}>
            <div style={{ flex: 1, maxWidth: 140, height: 4, borderRadius: 2, background: "var(--anchoran-border)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(((driveSpace.total - driveSpace.free) / driveSpace.total) * 100)}%`,
                  background: "var(--anchoran-accent)",
                  borderRadius: 2,
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: "var(--anchoran-text-secondary)" }}>
              {formatSize(driveSpace.free, false)} free of {formatSize(driveSpace.total, false)}
            </span>
          </div>
        )}
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
                <IconTile name="folder" size={38} glyphScale={0.56} />
                <span>{q.label}</span>
              </div>
            ))}
            {drives.map((d) => (
              <div key={d} className="files-item" onDoubleClick={() => setCurrentPath(d)} onClick={() => setCurrentPath(d)}>
                <IconTile name="files" size={38} glyphScale={0.56} />
                <span>{d}</span>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div style={{ color: "#E5484D", fontSize: 13, padding: 12 }}>{loadError}</div>
        ) : viewMode === "grid" ? (
          <div className="files-grid">
            {sorted.map((entry) => (
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
                <IconTile name={entry.isDirectory ? "folder" : iconForFile(entry.name)} size={38} glyphScale={0.56} />
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
            {sorted.length === 0 && (
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
              {sorted.map((entry) => (
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
                    <IconTile name={entry.isDirectory ? "folder" : iconForFile(entry.name)} size={20} glyphScale={0.6} />
                    <span>
                      {entry.name}
                      {searchingSubfolders && (
                        <div style={{ fontSize: 11, color: "var(--anchoran-text-secondary)" }}>
                          {entry.path.slice(currentPath.length + 1, entry.path.length - entry.name.length - 1) || "."}
                        </div>
                      )}
                    </span>
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
      {quickLookEntry && <QuickLook entry={quickLookEntry} onClose={() => setQuickLookEntry(null)} />}
      {propertiesEntry && <FileProperties entry={propertiesEntry} onClose={() => setPropertiesEntry(null)} />}
      {batchRenamePaths && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 55, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setBatchRenamePaths(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(90%, 360px)", background: "var(--anchoran-surface)", borderRadius: "var(--anchoran-radius-lg)", boxShadow: "var(--anchoran-shadow-window)", padding: 20 }}
          >
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Batch rename {batchRenamePaths.length} items</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5 }}>
              <label>
                Prefix
                <input
                  autoFocus
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value)}
                  placeholder="e.g. vacation-"
                  style={{ width: "100%", marginTop: 4, padding: "7px 9px", borderRadius: "var(--anchoran-radius-sm)", border: "1px solid var(--anchoran-border)", background: "transparent", color: "var(--anchoran-text-primary)" }}
                />
              </label>
              <label>
                Suffix (before the extension)
                <input
                  value={batchSuffix}
                  onChange={(e) => setBatchSuffix(e.target.value)}
                  placeholder="e.g. -2026"
                  style={{ width: "100%", marginTop: 4, padding: "7px 9px", borderRadius: "var(--anchoran-radius-sm)", border: "1px solid var(--anchoran-border)", background: "transparent", color: "var(--anchoran-text-primary)" }}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="app-toolbar-btn" style={{ flex: 1, justifyContent: "center" }} onClick={() => setBatchRenamePaths(null)}>
                Cancel
              </button>
              <button
                className="app-toolbar-btn"
                style={{ flex: 1, justifyContent: "center" }}
                disabled={!batchPrefix && !batchSuffix}
                onClick={() => {
                  batchRename(batchRenamePaths, batchPrefix, batchSuffix);
                  setBatchRenamePaths(null);
                  setBatchPrefix("");
                  setBatchSuffix("");
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
