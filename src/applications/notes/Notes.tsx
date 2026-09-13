import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { printTextAsPdf } from "@/core/print";
import { useNotificationStore } from "@/notifications/notificationStore";
import { AnchoranFilePicker } from "@/core/AnchoranFilePicker";
import "@/applications/apps.css";
import "./notes.css";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inline markdown spans — code, bold, italic, links — applied within a single already-HTML-escaped line. */
function renderInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/**
 * A compact, self-written markdown renderer — headers, bold/italic,
 * inline and fenced code, links, lists, blockquotes and rules —
 * rather than adding an external markdown library for one preview
 * pane, matching how icons/wallpapers/sounds elsewhere in Anchoran are
 * generated in code instead of pulled in as assets. The source text is
 * HTML-escaped before any markdown syntax is applied, so pasted HTML
 * in a note renders as literal text, not live markup.
 */
function renderMarkdown(source: string): string {
  const lines = escapeHtml(source).split("\n");
  let html = "";
  let inList = false;
  let inCode = false;
  for (const raw of lines) {
    if (raw.trim().startsWith("```")) {
      inCode = !inCode;
      html += inCode ? "<pre><code>" : "</code></pre>";
      continue;
    }
    if (inCode) {
      html += `${raw}\n`;
      continue;
    }
    const heading = raw.match(/^(#{1,6})\s+(.*)/);
    if (heading) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      const level = heading[1].length;
      html += `<h${level}>${renderInline(heading[2])}</h${level}>`;
      continue;
    }
    if (/^\s*>\s?/.test(raw)) {
      html += `<blockquote>${renderInline(raw.replace(/^\s*>\s?/, ""))}</blockquote>`;
      continue;
    }
    if (/^\s*([-*+])\s+/.test(raw)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${renderInline(raw.replace(/^\s*([-*+])\s+/, ""))}</li>`;
      continue;
    }
    if (inList) {
      html += "</ul>";
      inList = false;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(raw)) {
      html += "<hr/>";
      continue;
    }
    html += raw.trim() === "" ? "<br/>" : `<p>${renderInline(raw)}</p>`;
  }
  if (inList) html += "</ul>";
  if (inCode) html += "</code></pre>";
  return html;
}

/**
 * Notes is now a real Notepad-style editor: it can open, edit and save
 * any real text file on Windows (via the native Open/Save As dialogs),
 * the same as any file editor — not tied to a fixed folder of its own
 * documents. Files' own right-click → "Open with…" launches the
 * user's actual chosen app via Windows itself (see fs-open-with in
 * electron/main.ts); this is the app people would pick when they want
 * something Anchoran-native for a quick edit.
 */
export function NotesApp({ openPath }: { openPath?: string }) {
  const [path, setPath] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const [savePicker, setSavePicker] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const pushNotification = useNotificationStore((s) => s.push);

  // Unsaved edits are real, user-typed text — losing them silently to
  // an accidental "New" or "Open…" click would be a real data-loss bug,
  // the same way it would be in any real text editor.
  function confirmDiscard() {
    return !dirty || window.confirm("You have unsaved changes. Discard them?");
  }

  async function loadPath(filePath: string) {
    if (!window.anchoran) return;
    const read = await window.anchoran.fsReadTextFile(filePath);
    if ("error" in read) {
      pushNotification("Notes", read.error);
      return;
    }
    setPath(filePath);
    setTitle(filePath.slice(filePath.lastIndexOf("\\") + 1));
    setContent(read.content);
    setDirty(false);
  }

  // Opened directly from Files (its "default app" for text files) —
  // loads that file the same way "Open…" would, including a re-open
  // if the window was already open and Files pointed it at another
  // file (single-instance apps get refocused, not re-created).
  useEffect(() => {
    if (openPath && confirmDiscard()) loadPath(openPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPath]);

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
    if ("path" in result) await loadPath(result.path);
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
        <button className="app-toolbar-btn" data-op={previewMode} onClick={() => setPreviewMode((v) => !v)}>
          {previewMode ? "Edit" : "Preview"}
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--anchoran-text-secondary)" }}>{title}</span>
      </div>
      <div className="notes-editor">
        {previewMode ? (
          <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
        ) : (
          <textarea
            className="notes-textarea"
            placeholder="Start typing… (Markdown supported — click Preview to see it rendered)"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
            autoFocus
          />
        )}
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
