import { useState } from "react";
import { Icon } from "@/components/Icon";
import { printTextAsPdf } from "@/core/print";
import { useNotificationStore } from "@/notifications/notificationStore";
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
  const pushNotification = useNotificationStore((s) => s.push);

  function newDocument() {
    setPath(null);
    setTitle("Untitled");
    setContent("");
    setDirty(false);
  }

  async function openFile() {
    if (!window.anchoran) return;
    const result = await window.anchoran.pickOpenTextFile();
    if (!result) return;
    if ("error" in result) {
      pushNotification("Notes", result.error);
      return;
    }
    setPath(result.path);
    setTitle(result.path.slice(result.path.lastIndexOf("\\") + 1));
    setContent(result.content);
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
    await saveAs();
  }

  async function saveAs() {
    if (!window.anchoran) return;
    const result = await window.anchoran.pickSaveTextFile(`${title}.txt`, content);
    if (!result) return;
    if ("error" in result) {
      pushNotification("Notes", result.error);
      return;
    }
    setPath(result.path);
    setTitle(result.path.slice(result.path.lastIndexOf("\\") + 1));
    setDirty(false);
  }

  return (
    <div className="notes-root">
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
      <div className="notes-editor" style={{ width: "100%" }}>
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
    </div>
  );
}
