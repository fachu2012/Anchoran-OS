import { useState } from "react";
import JSZip from "jszip";
import { Icon } from "@/components/Icon";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./ziptool.css";

const TEXT_LIKE = /\.(txt|md|json|csv|log|js|ts|css|html|xml|yml|yaml)$/i;

export function ZipToolApp() {
  const pushNotification = useNotificationStore((s) => s.push);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function addDirToZip(zip: JSZip, dirPath: string, relPath: string) {
    const result = await window.anchoran!.fsListDir(dirPath);
    if ("error" in result) return;
    for (const entry of result.entries) {
      const entryRel = relPath ? `${relPath}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        await addDirToZip(zip, entry.path, entryRel);
      } else {
        const isText = TEXT_LIKE.test(entry.name);
        if (isText) {
          const text = await window.anchoran!.fsReadTextFile(entry.path);
          zip.file(entryRel, "content" in text ? text.content : "");
        } else {
          const img = await window.anchoran!.fsReadImageFile(entry.path);
          if ("dataUrl" in img) {
            zip.file(entryRel, img.dataUrl.split(",")[1] ?? "", { base64: true });
          } else {
            zip.file(entryRel, ""); // Unsupported binary type — recorded as an empty placeholder.
          }
        }
      }
    }
  }

  async function exportZip() {
    if (!window.anchoran) return;
    const folder = await window.anchoran.pickFolder("Choose a folder to export");
    if (!folder) return;
    setBusy(true);
    setStatus(null);
    try {
      const zip = new JSZip();
      const folderName = folder.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "Export";
      await addDirToZip(zip, folder, "");
      const base64 = await zip.generateAsync({ type: "base64" });
      const result = await window.anchoran.saveAndOpenFile(`${folderName}.zip`, base64);
      setStatus(result.success ? "Exported and opened." : result.error ?? "Couldn't export.");
    } finally {
      setBusy(false);
    }
  }

  async function importZip() {
    if (!window.anchoran) return;
    const zipResult = await window.anchoran.pickZipFile();
    if (!zipResult) return;
    if ("error" in zipResult) {
      setStatus(zipResult.error);
      return;
    }
    const destParent = await window.anchoran.pickFolder("Choose where to extract");
    if (!destParent) return;
    setBusy(true);
    setStatus(null);
    try {
      const zip = await JSZip.loadAsync(zipResult.base64, { base64: true });
      const rootFolderName = zipResult.fileName.replace(/\.zip$/i, "");
      const rootDirResult = await window.anchoran.fsCreateFolder(destParent, rootFolderName);
      if ("error" in rootDirResult) {
        setStatus(rootDirResult.error);
        return;
      }
      const dirByPath = new Map<string, string>([["", rootDirResult.path]]);
      const entries = Object.values(zip.files).sort((a, b) => a.name.length - b.name.length);
      for (const entry of entries) {
        const parts = entry.name.replace(/\/$/, "").split("/");
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join("/");
        const parentDir = dirByPath.get(parentPath) ?? rootDirResult.path;
        if (entry.dir) {
          const created = await window.anchoran.fsCreateFolder(parentDir, name);
          if (!("error" in created)) dirByPath.set(parts.join("/"), created.path);
        } else if (TEXT_LIKE.test(name)) {
          const text = await entry.async("text");
          await window.anchoran.fsCreateFile(parentDir, name, text);
        } else {
          const base64 = await entry.async("base64");
          await window.anchoran.fsWriteDataUrl(parentDir, name, `data:application/octet-stream;base64,${base64}`);
        }
      }
      setStatus(`Imported "${zipResult.fileName}" into ${rootDirResult.path}.`);
      pushNotification("Zip Tool", `Imported ${zipResult.fileName}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-root">
      <div className="app-content ziptool-content">
        <div className="ziptool-section">
          <div className="ziptool-section-title">Export a folder to .zip</div>
          <button className="app-toolbar-btn" onClick={exportZip} disabled={busy}>
            <Icon name="zipTool" size={14} /> Choose folder to export…
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
