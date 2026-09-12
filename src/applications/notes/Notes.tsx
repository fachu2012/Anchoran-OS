import { useState } from "react";
import { Icon } from "@/components/Icon";
import { printTextAsPdf } from "@/core/print";
import { useNotificationStore } from "@/notifications/notificationStore";
import { AnchoranFilePicker } from "@/core/AnchoranFilePicker";
import "@/applications/apps.css";
import "./notes.css";

/**
 * Notes is now a real Notepad-style editor: it can open, edit and save
 * any real text file on Windows (via the native Open/Save As dialogs),
 * the same as any file editor — not tied to a fixed folder of its own
 * documents. Files' own right-click → "Open with…" launches the
 * user's actual chosen app via Windows itself (see fs-open-with in
 * electron/main.ts); this is the app people would pick when they want
 * something Anchoran-native for a quick edit.
 */
export function NotesApp() {
  const [path, setPath] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const [savePicker, setSavePicker] = useState(false);
  const pushNotification = useNotificationStore((s) => s.push);

  // Unsaved edits are real, user-typed text — losing them silently to
  // an accidental "New" or "Open…" click would be a real data-loss bug,
  // the same way it would be in any real text editor.
  function confirmDiscard() {
    return !dirty || window.confirm("You have unsaved changes. Discard them?");
  }

  function newDocument() {
    if (!confirmDiscard()) return;
    setPath(null);
    setTitle("Untitled");
    setContent("");
    setDirty(false);
  }

  function openFile() {
    if (!confirmDiscard()) return;
    setOpenPicker(true);
  }

  async function onPickOpen(result: { path: string } | { dir: string; name: string }) {
    setOpenPicker(false);
    if (!("path" in result) || !window.anchoran) return;
    const read = await window.anchoran.fsReadTextFile(result.path);
    if ("error" in read) {
      pushNotification("Notes", read.error);
      return;
    }
    setPath(result.path);
    setTitle(result.path.slice(result.path.lastIndexOf("\\") + 1));
    setContent(read.content);
    setDirty(false);
  }

  async function save() {
    if (!window.anchoran) return;
    if (path) {
      const result = await window.anchoran.fsWriteTextFile(path, content);
      if (!result.success) pushNotification("Notes", result.error ?? "Couldn't save.");
      else setDirty(false);
      return;
    }
    saveAs();
  }

  function saveAs() {
    setSavePicker(true);
  }

  async function onPickSave(result: { path: string } | { dir: string; name: string }) {
    setSavePicker(false);
    if (!("dir" in result) || !window.anchoran) return;
    const name = /\.[^.\\/]+$/.test(result.name) ? result.name : `${result.name}.txt`;
    const fullPath = `${result.dir}\\${name}`;
    const write = await window.anchoran.fsWriteTextFile(fullPath, content);
    if (!write.success) {
      pushNotification("Notes", write.error ?? "Couldn't save.");
      return;
    }
    setPath(fullPath);
    setTitle(name);
    setDirty(false);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={newDocument}>
          <Icon name="file" size={14} /> New
        </button>
        <button className="app-toolbar-btn" onClick={openFile}>
          Open…
        </button>
        <button className="app-toolbar-btn" onClick={save}>
          Save{dirty ? " •" : ""}
        </button>
        <button className="app-toolbar-btn" onClick={saveAs}>
          Save As…
        </button>
        <button className="app-toolbar-btn" onClick={() => printTextAsPdf(title.replace(/\.[^.]+$/, ""), content)}>
          Print
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--anchoran-text-secondary)" }}>{title}</span>
      </div>
      <div className="notes-editor">
        <textarea
          className="notes-textarea"
          placeholder="Start typing…"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setDirty(true);
          }}
          autoFocus
        />
      </div>
      {openPicker && (
        <AnchoranFilePicker
          mode="open"
          title="Open a text file"
          onConfirm={onPickOpen}
          onCancel={() => setOpenPicker(false)}
        />
      )}
      {savePicker && (
        <AnchoranFilePicker
          mode="save"
          title="Save As"
          defaultName={/\.[^.\\/]+$/.test(title) ? title : `${title}.txt`}
          onConfirm={onPickSave}
          onCancel={() => setSavePicker(false)}
        />
      )}
    </div>
  );
}
