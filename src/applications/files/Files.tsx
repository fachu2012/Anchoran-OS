import { useEffect, useState, type DragEvent } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { useNotificationStore } from "@/notifications/notificationStore";
import { ContextMenu, type ContextMenuItem } from "@/desktop/ContextMenu";
import { printTextAsPdf } from "@/core/print";
import { QuickLook } from "./QuickLook";
import "@/applications/apps.css";

const THIS_PC = "This PC";
type Entry = { name: string; path: string; isDirectory: boolean; size: number; modifiedAt: number };
type Clipboard = { paths: string[]; mode: "copy" | "cut" } | null;

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

// Icon-only sets — purely cosmetic, so these can be as broad as real
// file extensions actually in use, even ones Anchoran can't open yet.
const ICON_IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff", ".tif", ".bmp", ".heic", ".raw", ".cr2", ".nef", ".arw", ".ico", ".icns", ".psd", ".xcf", ".tga", ".iff"]);
const ICON_DOC_EXT = new Set([".docx", ".doc", ".odt", ".rtf", ".pages", ".wpd", ".wps", ".dotx", ".md", ".txt", ".log"]);
const ICON_PDF_EXT = new Set([".pdf"]);
const ICON_SHEET_EXT = new Set([".xlsx", ".xls", ".ods", ".numbers", ".csv", ".xltx"]);
const ICON_PRESENTATION_EXT = new Set([".pptx", ".ppt", ".odp", ".key", ".potx"]);
const ICON_EBOOK_EXT = new Set([".epub", ".mobi", ".azw3", ".djvu"]);
const ICON_EMAIL_EXT = new Set([".msg", ".eml"]);
const ICON_VECTOR_EXT = new Set([".svg", ".ai", ".eps", ".cdr", ".indd", ".sketch", ".fig"]);
const ICON_MODEL3D_EXT = new Set([".obj", ".fbx", ".stl", ".blend", ".skp", ".3ds"]);
const ICON_VIDEO_EXT = new Set([".mp4", ".mkv", ".mov", ".avi", ".wmv", ".flv", ".webm", ".mpeg", ".mpg", ".m4v", ".3gp", ".ts", ".vob", ".ogv", ".rmvb", ".asf", ".divx", ".swf"]);
const ICON_AUDIO_EXT = new Set([".mp3", ".wav", ".flac", ".m4a", ".aac", ".wma", ".ogg", ".opus", ".mid", ".midi", ".amr", ".aif", ".aiff", ".ape", ".mka", ".mpc", ".ra"]);
const ICON_ARCHIVE_EXT = new Set([".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".cab", ".jar", ".wim"]);
const ICON_DISK_EXT = new Set([".iso", ".bin", ".cue", ".img", ".vhd", ".vhdx", ".vmdk", ".ova", ".ovf", ".pvm"]);
const ICON_EXE_EXT = new Set([".exe", ".msi", ".dmg", ".app", ".apk", ".aab", ".deb", ".rpm", ".dll", ".sys", ".drv", ".com", ".gadget", ".scr", ".efi"]);
const ICON_DB_EXT = new Set([".db", ".sqlite", ".sqlite3", ".mdb", ".accdb", ".bak", ".dat", ".gdb", ".nsf", ".frm", ".ibd"]);
const ICON_FONT_EXT = new Set([".ttf", ".otf", ".woff", ".woff2", ".eot", ".fnt"]);
const ICON_ROM_EXT = new Set([".rom", ".sav", ".pak", ".paks", ".vpk", ".gsa", ".nds", ".gba", ".sfc", ".nes"]);
const ICON_CERT_EXT = new Set([".pfx", ".p12", ".crt", ".csr", ".pem", ".pub", ".ppk"]);
const ICON_SHORTCUT_EXT = new Set([".lnk", ".url", ".alias"]);
const ICON_SUBTITLE_EXT = new Set([".srt", ".ass"]);
const ICON_CODE_EXT = new Set([".js", ".ts", ".tsx", ".jsx", ".json", ".xml", ".html", ".htm", ".css", ".py", ".java", ".c", ".cpp", ".cs", ".sh", ".bat", ".ps1", ".rb", ".go", ".rs", ".swift", ".sql", ".yaml", ".yml", ".ini", ".config", ".env", ".sass", ".scss", ".vue", ".asp", ".aspx", ".pl", ".kt", ".dart", ".lua", ".asm", ".h", ".php"]);

/** Picks a more specific icon by extension where Anchoran has one, falling back to a generic file icon. */
function iconForFile(name: string): IconName {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (ICON_IMAGE_EXT.has(ext)) return "photoViewer";
  if (ICON_PDF_EXT.has(ext)) return "pdfFile";
  if (ICON_PRESENTATION_EXT.has(ext)) return "presentation";
  if (ICON_SHEET_EXT.has(ext)) return "spreadsheet";
  if (ICON_EBOOK_EXT.has(ext)) return "ebook";
  if (ICON_EMAIL_EXT.has(ext)) return "email";
  if (ICON_VECTOR_EXT.has(ext)) return "vectorDesign";
  if (ICON_MODEL3D_EXT.has(ext)) return "model3d";
  if (ICON_VIDEO_EXT.has(ext)) return "videoFile";
  if (ICON_AUDIO_EXT.has(ext)) return "audioFile";
  if (ICON_ARCHIVE_EXT.has(ext)) return "zipTool";
  if (ICON_DISK_EXT.has(ext)) return "diskImage";
  if (ICON_EXE_EXT.has(ext)) return "executable";
  if (ICON_DB_EXT.has(ext)) return "database";
  if (ICON_FONT_EXT.has(ext)) return "fontFile";
  if (ICON_ROM_EXT.has(ext)) return "gameRom";
  if (ICON_CERT_EXT.has(ext)) return "certificate";
  if (ICON_SHORTCUT_EXT.has(ext)) return "shortcut";
  if (ICON_SUBTITLE_EXT.has(ext)) return "subtitle";
  if (ICON_CODE_EXT.has(ext)) return "jsonFormatter";
  if (ICON_DOC_EXT.has(ext)) return "document";
  return "file";
}

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
  const [quickLookEntry, setQuickLookEntry] = useState<Entry | null>(null);
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
      if (openFile || renamingPath || quickLookEntry) return;
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
  }, [selected, clipboard, openFile, renamingPath, currentPath, quickLookEntry, entries]);

  function entryMenuItems(entry: Entry): ContextMenuItem[] {
    const paths = selected.has(entry.path) && selected.size > 1 ? Array.from(selected) : [entry.path];
    return [
      { label: "Open", onSelect: () => openEntry(entry) },
      ...(!entry.isDirectory
        ? [
            { label: "Quick Look", onSelect: () => setQuickLookEntry(entry) },
            { label: "Open with…", onSelect: () => window.anchoran!.fsOpenWith(entry.path) },
          ]
        : []),
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
                <Icon name={entry.isDirectory ? "folder" : iconForFile(entry.name)} size={30} />
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
                    <Icon name={entry.isDirectory ? "folder" : iconForFile(entry.name)} size={15} />
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
      {quickLookEntry && <QuickLook entry={quickLookEntry} onClose={() => setQuickLookEntry(null)} />}
    </div>
  );
}
