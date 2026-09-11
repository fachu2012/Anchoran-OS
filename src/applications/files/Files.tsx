import { useEffect, useState, type DragEvent } from "react";
import { Icon } from "@/components/Icon";
import { useFsStore, ROOT_ID, TRASH_ID, DESKTOP_ID, type FsNode } from "@/filesystem/fs";
import { useNotificationStore } from "@/notifications/notificationStore";
import { ContextMenu, type ContextMenuItem } from "@/desktop/ContextMenu";
import { printTextAsPdf } from "@/core/print";
import "@/applications/apps.css";

const DRAG_MIME = "application/x-anchoran-node-id";

// Extensions Anchoran can read as plain text when importing a real file
// dragged in from Windows Explorer. Anything else (images, PDFs,
// archives, executables…) is registered as an empty placeholder entry
// rather than silently dropped — Anchoran's virtual filesystem only
// stores text content today, so binary import is a known limitation.
const TEXT_EXTENSIONS = [".txt", ".md", ".json", ".csv", ".log", ".js", ".ts", ".css", ".html", ".xml", ".yml", ".yaml"];

function isTextFile(file: File) {
  const name = file.name.toLowerCase();
  return file.type.startsWith("text/") || TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

type Clipboard = { ids: string[]; mode: "copy" | "cut" } | null;

export function FilesApp() {
  const [currentId, setCurrentId] = useState(ROOT_ID);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<Clipboard>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; item: FsNode | null } | null>(null);

  const childrenOf = useFsStore((s) => s.childrenOf);
  const getPath = useFsStore((s) => s.getPath);
  const createFolder = useFsStore((s) => s.createFolder);
  const createFile = useFsStore((s) => s.createFile);
  const removeMany = useFsStore((s) => s.removeMany);
  const restore = useFsStore((s) => s.restore);
  const permanentlyDelete = useFsStore((s) => s.permanentlyDelete);
  const emptyTrash = useFsStore((s) => s.emptyTrash);
  const rename = useFsStore((s) => s.rename);
  const moveMany = useFsStore((s) => s.moveMany);
  const duplicateMany = useFsStore((s) => s.duplicateMany);
  const search = useFsStore((s) => s.search);
  const updateContent = useFsStore((s) => s.updateContent);
  const getNode = useFsStore((s) => s.getNode);
  const canUndo = useFsStore((s) => s.canUndo());
  const canRedo = useFsStore((s) => s.canRedo());
  const undo = useFsStore((s) => s.undo);
  const redo = useFsStore((s) => s.redo);
  const pushNotification = useNotificationStore((s) => s.push);

  const openFile = openFileId ? getNode(openFileId) : undefined;

  const inTrash = currentId === TRASH_ID;
  const searching = query.trim().length > 0;
  const items = searching ? search(query) : childrenOf(currentId);
  const path = getPath(currentId);

  useEffect(() => {
    setSelected(new Set());
  }, [currentId, query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (openFileId) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "c" && selected.size > 0) {
        setClipboard({ ids: Array.from(selected), mode: "copy" });
      } else if (mod && e.key.toLowerCase() === "x" && selected.size > 0 && !inTrash) {
        setClipboard({ ids: Array.from(selected), mode: "cut" });
      } else if (mod && e.key.toLowerCase() === "v" && clipboard && !inTrash) {
        pasteClipboard();
      } else if (e.key === "Delete" && selected.size > 0) {
        if (inTrash) {
          selected.forEach((id) => permanentlyDelete(id));
        } else {
          removeMany(Array.from(selected));
        }
        setSelected(new Set());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, clipboard, inTrash, openFileId, currentId]);

  function pasteClipboard() {
    if (!clipboard) return;
    if (clipboard.mode === "copy") duplicateMany(clipboard.ids, currentId);
    else {
      moveMany(clipboard.ids, currentId);
      setClipboard(null);
    }
  }

  async function importExternalFiles(fileList: FileList, targetFolderId: string) {
    let imported = 0;
    let skipped = 0;
    for (const file of Array.from(fileList)) {
      if (isTextFile(file)) {
        const content = await file.text();
        createFile(targetFolderId, file.name, content);
        imported += 1;
      } else {
        createFile(targetFolderId, file.name, "");
        skipped += 1;
      }
    }
    if (imported > 0 || skipped > 0) {
      pushNotification(
        "Files",
        skipped > 0
          ? `Imported ${imported} file(s). ${skipped} binary file(s) were added without content (not yet supported).`
          : `Imported ${imported} file(s).`
      );
    }
  }

  function onDropOnFolder(e: DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    const draggedId = e.dataTransfer.getData(DRAG_MIME);
    if (draggedId) {
      const ids = selected.has(draggedId) ? Array.from(selected) : [draggedId];
      moveMany(ids.filter((id) => id !== targetId), targetId);
      return;
    }
    if (e.dataTransfer.files.length > 0) {
      importExternalFiles(e.dataTransfer.files, targetId);
    }
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    setSelected((prev) => {
      const next = new Set(e.ctrlKey || e.metaKey ? prev : []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startRename(item: FsNode) {
    setRenamingId(item.id);
    setRenameValue(item.name);
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) rename(renamingId, renameValue.trim());
    setRenamingId(null);
  }

  function itemMenuItems(item: FsNode): ContextMenuItem[] {
    const ids = selected.has(item.id) && selected.size > 1 ? Array.from(selected) : [item.id];
    if (inTrash) {
      return [
        { label: ids.length > 1 ? `Restore ${ids.length} items` : "Restore", onSelect: () => ids.forEach(restore) },
        {
          label: ids.length > 1 ? `Delete ${ids.length} items permanently` : "Delete permanently",
          onSelect: () => ids.forEach(permanentlyDelete),
        },
      ];
    }
    return [
      { label: "Open", onSelect: () => (item.type === "folder" ? setCurrentId(item.id) : setOpenFileId(item.id)) },
      { label: "Cut", onSelect: () => setClipboard({ ids, mode: "cut" }) },
      { label: "Copy", onSelect: () => setClipboard({ ids, mode: "copy" }) },
      ...(ids.length === 1 ? [{ label: "Rename", onSelect: () => startRename(item) }] : []),
      { label: "Duplicate", onSelect: () => duplicateMany(ids, currentId) },
      { label: ids.length > 1 ? `Delete ${ids.length} items` : "Delete", onSelect: () => removeMany(ids) },
    ];
  }

  function emptySpaceMenuItems(): ContextMenuItem[] {
    if (inTrash) return [];
    const items: ContextMenuItem[] = [
      { label: "New Folder", onSelect: () => createFolder(currentId, "New Folder") },
      { label: "New File", onSelect: () => createFile(currentId, "New File.txt") },
    ];
    if (clipboard) items.push({ label: "Paste", onSelect: pasteClipboard });
    return items;
  }

  if (openFile) {
    return (
      <div className="app-root">
        <div className="app-toolbar">
          <button className="app-toolbar-btn" onClick={() => setOpenFileId(null)}>
            <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} /> Back
          </button>
          <input
            value={openFile.name}
            onChange={(e) => rename(openFile.id, e.target.value)}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--anchoran-text-primary)",
              fontSize: 13,
              fontWeight: 500,
              flex: 1,
            }}
          />
          <button
            className="app-toolbar-btn"
            onClick={() => printTextAsPdf(openFile.name.replace(/\.[^.]+$/, ""), openFile.content ?? "")}
          >
            Print
          </button>
        </div>
        <div className="app-content" style={{ padding: 0 }}>
          <textarea
            value={openFile.content ?? ""}
            onChange={(e) => updateContent(openFile.id, e.target.value)}
            style={{
              width: "100%",
              height: "100%",
              padding: 16,
              border: "none",
              outline: "none",
              resize: "none",
              background: "transparent",
              color: "var(--anchoran-text-primary)",
              fontFamily: "inherit",
              fontSize: 14,
              lineHeight: 1.6,
            }}
            autoFocus
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={() => createFolder(currentId, "New Folder")} disabled={inTrash}>
          <Icon name="folder" size={14} /> New Folder
        </button>
        <button className="app-toolbar-btn" onClick={() => createFile(currentId, "New File.txt")} disabled={inTrash}>
          <Icon name="file" size={14} /> New File
        </button>
        <button className="app-toolbar-btn" onClick={undo} disabled={!canUndo} aria-label="Undo">
          <Icon name="restart" size={13} style={{ transform: "scaleX(-1)" }} />
        </button>
        <button className="app-toolbar-btn" onClick={redo} disabled={!canRedo} aria-label="Redo">
          <Icon name="restart" size={13} />
        </button>
        <button className="app-toolbar-btn" onClick={() => setCurrentId(DESKTOP_ID)} data-op={currentId === DESKTOP_ID}>
          Desktop
        </button>
        <button
          className="app-toolbar-btn"
          onClick={() => {
            setQuery("");
            setCurrentId(TRASH_ID);
          }}
          data-op={inTrash}
        >
          Trash
        </button>
        {inTrash && items.length > 0 && (
          <button className="app-toolbar-btn" onClick={emptyTrash}>
            Empty Trash
          </button>
        )}
        <input
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            border: "1px solid var(--anchoran-border)",
            borderRadius: 6,
            padding: "5px 9px",
            background: "var(--anchoran-bg)",
            color: "var(--anchoran-text-primary)",
            fontSize: 12.5,
            width: 140,
          }}
        />
        <button
          className="app-toolbar-btn"
          onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
          style={{ marginLeft: "auto" }}
        >
          {viewMode === "grid" ? "List view" : "Grid view"}
        </button>
        {!searching && <span className="files-path">{path.map((n) => n.name).join(" / ")}</span>}
      </div>
      <div
        className="app-content"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => !inTrash && !searching && onDropOnFolder(e, currentId)}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, item: null });
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected(new Set());
        }}
      >
        {viewMode === "grid" ? (
          <div className="files-grid">
            {!searching && path.length > 1 && (
              <div className="files-item" onDoubleClick={() => setCurrentId(path[path.length - 2].id)}>
                <Icon name="folder" size={30} />
                <span>..</span>
              </div>
            )}
            {items.map((item) => (
              <div
                key={item.id}
                className="files-item"
                data-selected={selected.has(item.id)}
                data-cut={clipboard?.mode === "cut" && clipboard.ids.includes(item.id)}
                draggable={!inTrash}
                data-drag-over={item.type === "folder" && dragOverId === item.id}
                onClick={(e) => toggleSelect(item.id, e)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, item.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (item.type !== "folder" || inTrash) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverId(item.id);
                }}
                onDragLeave={() => setDragOverId((id) => (id === item.id ? null : id))}
                onDrop={(e) => item.type === "folder" && !inTrash && onDropOnFolder(e, item.id)}
                onDoubleClick={() => {
                  if (inTrash) return;
                  if (item.type === "folder") setCurrentId(item.id);
                  else setOpenFileId(item.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!selected.has(item.id)) setSelected(new Set([item.id]));
                  setMenu({ x: e.clientX, y: e.clientY, item });
                }}
              >
                <Icon name={item.type === "folder" ? "folder" : "file"} size={30} />
                {renamingId === item.id ? (
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
                  <span onDoubleClick={(e) => item.type !== "folder" && (e.stopPropagation(), startRename(item))}>
                    {item.name}
                  </span>
                )}
              </div>
            ))}
            {items.length === 0 && (
              <span style={{ color: "var(--anchoran-text-secondary)", fontSize: 13 }}>
                {searching ? "No results." : inTrash ? "Trash is empty." : "This folder is empty. Drag files here from Windows to import them."}
              </span>
            )}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--anchoran-text-secondary)" }}>
                <th style={{ fontWeight: 500, padding: "6px 8px" }}>Name</th>
                <th style={{ fontWeight: 500, padding: "6px 8px" }}>Type</th>
                <th style={{ fontWeight: 500, padding: "6px 8px" }}>Modified</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  data-selected={selected.has(item.id)}
                  onClick={(e) => toggleSelect(item.id, e)}
                  onDoubleClick={() => {
                    if (inTrash) return;
                    if (item.type === "folder") setCurrentId(item.id);
                    else setOpenFileId(item.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!selected.has(item.id)) setSelected(new Set([item.id]));
                    setMenu({ x: e.clientX, y: e.clientY, item });
                  }}
                  style={{ cursor: "default", borderTop: "1px solid var(--anchoran-border)" }}
                >
                  <td style={{ padding: "7px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name={item.type === "folder" ? "folder" : "file"} size={15} />
                    {item.name}
                  </td>
                  <td style={{ padding: "7px 8px", color: "var(--anchoran-text-secondary)" }}>
                    {item.type === "folder" ? "Folder" : "File"}
                  </td>
                  <td style={{ padding: "7px 8px", color: "var(--anchoran-text-secondary)" }}>
                    {formatDate(item.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.item ? itemMenuItems(menu.item) : emptySpaceMenuItems()}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
