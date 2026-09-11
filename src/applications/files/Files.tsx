import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useFsStore, ROOT_ID } from "@/filesystem/fs";
import "@/applications/apps.css";

export function FilesApp() {
  const [currentId, setCurrentId] = useState(ROOT_ID);
  const childrenOf = useFsStore((s) => s.childrenOf);
  const getPath = useFsStore((s) => s.getPath);
  const createFolder = useFsStore((s) => s.createFolder);
  const createFile = useFsStore((s) => s.createFile);
  const remove = useFsStore((s) => s.remove);
  const rename = useFsStore((s) => s.rename);

  const items = childrenOf(currentId);
  const path = getPath(currentId);

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={() => createFolder(currentId, "New Folder")}>
          <Icon name="folder" size={14} /> New Folder
        </button>
        <button className="app-toolbar-btn" onClick={() => createFile(currentId, "New File.txt")}>
          <Icon name="file" size={14} /> New File
        </button>
        <span className="files-path">{path.map((n) => n.name).join(" / ")}</span>
      </div>
      <div className="app-content">
        <div className="files-grid">
          {path.length > 1 && (
            <div
              className="files-item"
              onDoubleClick={() => setCurrentId(path[path.length - 2].id)}
            >
              <Icon name="folder" size={30} />
              <span>..</span>
            </div>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="files-item"
              onDoubleClick={() => {
                if (item.type === "folder") setCurrentId(item.id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                const action = window.prompt(
                  `"${item.name}" — type "rename:<name>" or "delete"`
                );
                if (!action) return;
                if (action === "delete") remove(item.id);
                else if (action.startsWith("rename:")) rename(item.id, action.slice(7));
              }}
            >
              <Icon name={item.type === "folder" ? "folder" : "file"} size={30} />
              <span>{item.name}</span>
            </div>
          ))}
          {items.length === 0 && path.length <= 1 && (
            <span style={{ color: "var(--anchoran-text-secondary)", fontSize: 13 }}>
              This folder is empty.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
