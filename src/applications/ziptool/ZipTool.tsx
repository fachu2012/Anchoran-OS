import { useState } from "react";
import JSZip from "jszip";
import { Icon } from "@/components/Icon";
import { useFsStore, ROOT_ID, TRASH_ID, type FsNode } from "@/filesystem/fs";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./ziptool.css";

export function ZipToolApp() {
  const nodes = useFsStore((s) => s.nodes);
  const childrenOf = useFsStore((s) => s.childrenOf);
  const createFolder = useFsStore((s) => s.createFolder);
  const createFile = useFsStore((s) => s.createFile);
  const pushNotification = useNotificationStore((s) => s.push);
  const [folderId, setFolderId] = useState(ROOT_ID);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const folders = Object.values(nodes).filter((n) => n.type === "folder" && n.id !== TRASH_ID);

  function addNodeToZip(zip: JSZip, node: FsNode, relPath: string) {
    if (node.type === "folder") {
      const folder = zip.folder(relPath) ?? zip;
      for (const child of childrenOf(node.id)) {
        addNodeToZip(zip, child, `${relPath}/${child.name}`);
      }
      void folder;
    } else {
      const content = node.content ?? "";
      if (content.startsWith("data:")) {
        const base64 = content.split(",")[1] ?? "";
        zip.file(relPath, base64, { base64: true });
      } else {
        zip.file(relPath, content);
      }
    }
  }

  async function exportZip() {
    setBusy(true);
    setStatus(null);
    try {
      const root = nodes[folderId];
      const zip = new JSZip();
      for (const child of childrenOf(folderId)) {
        addNodeToZip(zip, child, child.name);
      }
      const base64 = await zip.generateAsync({ type: "base64" });
      if (!window.anchoran) {
        setStatus("Exporting requires the Anchoran desktop app.");
        return;
      }
      const result = await window.anchoran.saveAndOpenFile(`${root?.name ?? "Export"}.zip`, base64);
      setStatus(result.success ? "Exported and opened." : result.error ?? "Couldn't export.");
    } finally {
      setBusy(false);
    }
  }

  async function importZip() {
    if (!window.anchoran) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await window.anchoran.pickZipFile();
      if (!result) return;
      if ("error" in result) {
        setStatus(result.error);
        return;
      }
      const zip = await JSZip.loadAsync(result.base64, { base64: true });
      const rootFolderName = result.fileName.replace(/\.zip$/i, "");
      const rootId = createFolder(folderId, rootFolderName);
      const folderIdByPath = new Map<string, string>([["", rootId]]);

      const entries = Object.values(zip.files).sort((a, b) => a.name.length - b.name.length);
      for (const entry of entries) {
        const parts = entry.name.replace(/\/$/, "").split("/");
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join("/");
        const parentId = folderIdByPath.get(parentPath) ?? rootId;
        if (entry.dir) {
          const newId = createFolder(parentId, name);
          folderIdByPath.set(parts.join("/"), newId);
        } else {
          const isTextLike = /\.(txt|md|json|csv|log|js|ts|css|html|xml|yml|yaml)$/i.test(name);
          if (isTextLike) {
            const text = await entry.async("text");
            createFile(parentId, name, text);
          } else {
            const base64 = await entry.async("base64");
            createFile(parentId, name, `data:application/octet-stream;base64,${base64}`);
          }
        }
      }
      setStatus(`Imported "${result.fileName}".`);
      pushNotification("Zip Tool", `Imported ${result.fileName}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-root">
      <div className="app-content ziptool-content">
        <div className="ziptool-section">
          <div className="ziptool-section-title">Export a folder to .zip</div>
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="ziptool-select">
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button className="app-toolbar-btn" onClick={exportZip} disabled={busy}>
            <Icon name="zipTool" size={14} /> Export .zip
          </button>
        </div>
        <div className="ziptool-section">
          <div className="ziptool-section-title">Import a .zip from Windows</div>
          <button className="app-toolbar-btn" onClick={importZip} disabled={busy}>
            Choose .zip file…
          </button>
        </div>
        {status && <div className="ziptool-status">{status}</div>}
      </div>
    </div>
  );
}
