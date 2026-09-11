import { useState, type DragEvent } from "react";
import { Icon } from "@/components/Icon";
import { useFsStore, ROOT_ID, TRASH_ID, type FsNode } from "@/filesystem/fs";
import { useNotificationStore } from "@/notifications/notificationStore";
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

export function FilesApp() {
  const [currentId, setCurrentId] = useState(ROOT_ID);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const childrenOf = useFsStore((s) => s.childrenOf);
  const getPath = useFsStore((s) => s.getPath);
  const createFolder = useFsStore((s) => s.createFolder);
  const createFile = useFsStore((s) => s.createFile);
  const remove = useFsStore((s) => s.remove);
  const restore = useFsStore((s) => s.restore);
  const permanentlyDelete = useFsStore((s) => s.permanentlyDelete);
  const emptyTrash = useFsStore((s) => s.emptyTrash);
  const rename = useFsStore((s) => s.rename);
  const move = useFsStore((s) => s.move);
  const search = useFsStore((s) => s.search);
  const pushNotification = useNotificationStore((s) => s.push);

  const inTrash = currentId === TRASH_ID;
  const searching = query.trim().length > 0;
  const items = searching ? search(query) : childrenOf(currentId);
  const path = getPath(currentId);

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
    if (draggedId && draggedId !== targetId) {
      move(draggedId, targetId);
      return;
    }
    if (e.dataTransfer.files.length > 0) {
      importExternalFiles(e.dataTransfer.files, targetId);
    }
  }

  function onItemAction(item: FsNode) {
    if (inTrash) {
      const action = window.prompt(`"${item.name}" — type "restore" or "delete" (permanent)`);
      if (action === "restore") restore(item.id);
      else if (action === "delete") permanentlyDelete(item.id);
      return;
    }
    const action = window.prompt(`"${item.name}" — type "rename:<name>" or "delete"`);
    if (!action) return;
    if (action === "delete") remove(item.id);
    else if (action.startsWith("rename:")) rename(item.id, action.slice(7));
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
                draggable={!inTrash}
                data-drag-over={item.type === "folder" && dragOverId === item.id}
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
                  if (item.type === "folder" && !inTrash) setCurrentId(item.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onItemAction(item);
                }}
              >
                <Icon name={item.type === "folder" ? "folder" : "file"} size={30} />
                <span>{item.name}</span>
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
                  onDoubleClick={() => {
                    if (item.type === "folder" && !inTrash) setCurrentId(item.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onItemAction(item);
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
    </div>
  );
}
