import { useState } from "react";
import JSZip from "jszip";
import { Icon } from "@/components/Icon";
import { useNotificationStore } from "@/notifications/notificationStore";
import { addPathToZip, extractZipTo } from "@/core/zipHelpers";
import { AnchoranFilePicker } from "@/core/AnchoranFilePicker";
import "@/applications/apps.css";
import "./ziptool.css";

type PickerState =
  | "export-folder"
  | "import-zip"
  | "extract-folder"
  | "add-target-zip"
  | "add-source-file"
  | "add-source-folder"
  | null;

export function ZipToolApp() {
  const pushNotification = useNotificationStore((s) => s.push);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState>(null);
  const [pendingZip, setPendingZip] = useState<{ base64: string; fileName: string } | null>(null);
  const [addMode, setAddMode] = useState<"file" | "folder" | null>(null);
  const [addTargetZip, setAddTargetZip] = useState<string | null>(null);

  async function exportZip(folder: string) {
    if (!window.anchoran) return;
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

  async function extractZip(zipResult: { base64: string; fileName: string }, destParent: string) {
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

  async function addToZip(zipPath: string, sourcePath: string, isFolder: boolean) {
    if (!window.anchoran) return;
    setBusy(true);
    setStatus(null);
    try {
      const binary = await window.anchoran.fsReadBinary(zipPath);
      if ("error" in binary) {
        setStatus(binary.error);
        return;
      }
      const zip = await JSZip.loadAsync(binary.base64, { base64: true });
      const itemName = sourcePath.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "item";
      await addPathToZip(zip, sourcePath, itemName, isFolder);
      const base64 = await zip.generateAsync({ type: "base64" });
      const dir = zipPath.slice(0, zipPath.lastIndexOf("\\"));
      const fileName = zipPath.slice(zipPath.lastIndexOf("\\") + 1);
      const write = await window.anchoran.fsWriteDataUrl(dir, fileName, `data:application/zip;base64,${base64}`);
      if ("error" in write) {
        setStatus(write.error);
        return;
      }
      setStatus(`Added "${itemName}" to ${fileName}.`);
      pushNotification("Zip Tool", `Added ${itemName} to ${fileName}.`);
    } finally {
      setBusy(false);
    }
  }

  async function onPickerConfirm(result: { path: string } | { dir: string; name: string }) {
    const mode = picker;
    setPicker(null);
    if (!("path" in result) || !window.anchoran) return;
    if (mode === "export-folder") {
      exportZip(result.path);
    } else if (mode === "import-zip") {
      const binary = await window.anchoran.fsReadBinary(result.path);
      if ("error" in binary) {
        setStatus(binary.error);
        return;
      }
      const fileName = result.path.slice(result.path.lastIndexOf("\\") + 1);
      setPendingZip({ base64: binary.base64, fileName });
      setPicker("extract-folder");
    } else if (mode === "extract-folder" && pendingZip) {
      const zipResult = pendingZip;
      setPendingZip(null);
      extractZip(zipResult, result.path);
    } else if (mode === "add-target-zip") {
      setAddTargetZip(result.path);
      setPicker(addMode === "folder" ? "add-source-folder" : "add-source-file");
    } else if ((mode === "add-source-file" || mode === "add-source-folder") && addTargetZip) {
      const target = addTargetZip;
      setAddTargetZip(null);
      addToZip(target, result.path, mode === "add-source-folder");
    }
  }

  return (
    <div className="app-root">
      <div className="app-content ziptool-content">
        <div className="ziptool-section">
          <div className="ziptool-section-title">Export a folder to .zip</div>
          <button className="app-toolbar-btn" onClick={() => setPicker("export-folder")} disabled={busy}>
            <Icon name="zipTool" size={14} /> Choose folder to export…
          </button>
        </div>
        <div className="ziptool-section">
          <div className="ziptool-section-title">Import a .zip</div>
          <button className="app-toolbar-btn" onClick={() => setPicker("import-zip")} disabled={busy}>
            Choose .zip file…
          </button>
        </div>
        <div className="ziptool-section">
          <div className="ziptool-section-title">Add to an existing .zip</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="app-toolbar-btn"
              onClick={() => {
                setAddMode("file");
                setPicker("add-target-zip");
              }}
              disabled={busy}
            >
              Add a file…
            </button>
            <button
              className="app-toolbar-btn"
              onClick={() => {
                setAddMode("folder");
                setPicker("add-target-zip");
              }}
              disabled={busy}
            >
              Add a folder…
            </button>
          </div>
        </div>
        {status && <div className="ziptool-status">{status}</div>}
      </div>
      {picker === "export-folder" && (
        <AnchoranFilePicker
          mode="folder"
          title="Choose a folder to export"
          onConfirm={onPickerConfirm}
          onCancel={() => setPicker(null)}
        />
      )}
      {picker === "import-zip" && (
        <AnchoranFilePicker
          mode="open"
          title="Choose a .zip file"
          extensions={[".zip"]}
          onConfirm={onPickerConfirm}
          onCancel={() => setPicker(null)}
        />
      )}
      {picker === "extract-folder" && (
        <AnchoranFilePicker
          mode="folder"
          title="Choose where to extract"
          onConfirm={onPickerConfirm}
          onCancel={() => {
            setPicker(null);
            setPendingZip(null);
          }}
        />
      )}
      {picker === "add-target-zip" && (
        <AnchoranFilePicker
          mode="open"
          title="Choose the .zip to add to"
          extensions={[".zip"]}
          onConfirm={onPickerConfirm}
          onCancel={() => {
            setPicker(null);
            setAddMode(null);
          }}
        />
      )}
      {picker === "add-source-file" && (
        <AnchoranFilePicker
          mode="open"
          title="Choose a file to add"
          onConfirm={onPickerConfirm}
          onCancel={() => {
            setPicker(null);
            setAddTargetZip(null);
          }}
        />
      )}
      {picker === "add-source-folder" && (
        <AnchoranFilePicker
          mode="folder"
          title="Choose a folder to add"
          onConfirm={onPickerConfirm}
          onCancel={() => {
            setPicker(null);
            setAddTargetZip(null);
          }}
        />
      )}
    </div>
  );
}
