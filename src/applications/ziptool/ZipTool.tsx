import { useState } from "react";
import JSZip from "jszip";
import { Icon } from "@/components/Icon";
import { useNotificationStore } from "@/notifications/notificationStore";
import { addPathToZip, extractZipTo } from "@/core/zipHelpers";
import "@/applications/apps.css";
import "./ziptool.css";

export function ZipToolApp() {
  const pushNotification = useNotificationStore((s) => s.push);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function exportZip() {
    if (!window.anchoran) return;
    const folder = await window.anchoran.pickFolder("Choose a folder to export");
    if (!folder) return;
    setBusy(true);
    setStatus(null);
    try {
      const zip = new JSZip();
      const folderName = folder.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "Export";
      await addPathToZip(zip, folder, "", true);
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
      const result = await extractZipTo(zip, destParent, rootFolderName);
      if ("error" in result) {
        setStatus(result.error);
        return;
      }
      setStatus(`Imported "${zipResult.fileName}" into ${result.path}.`);
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
