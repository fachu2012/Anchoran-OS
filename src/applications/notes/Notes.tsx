import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useFsStore } from "@/filesystem/fs";
import { printTextAsPdf } from "@/core/print";
import "@/applications/apps.css";
import "./notes.css";

const NOTES_FOLDER_ID = "notes";

export function NotesApp() {
  const childrenOf = useFsStore((s) => s.childrenOf);
  const createFile = useFsStore((s) => s.createFile);
  const rename = useFsStore((s) => s.rename);
  const remove = useFsStore((s) => s.remove);
  const updateContent = useFsStore((s) => s.updateContent);
  const getNode = useFsStore((s) => s.getNode);

  const notes = childrenOf(NOTES_FOLDER_ID).filter((n) => n.type === "file");
  const [activeId, setActiveId] = useState<string | null>(notes[0]?.id ?? null);

  useEffect(() => {
    if (!activeId && notes.length > 0) setActiveId(notes[0].id);
    if (activeId && !notes.some((n) => n.id === activeId)) setActiveId(notes[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes.length]);

  const active = activeId ? getNode(activeId) : undefined;

  function newNote() {
    const id = createFile(NOTES_FOLDER_ID, `Untitled ${notes.length + 1}.txt`, "");
    setActiveId(id);
  }

  return (
    <div className="notes-root">
      <div className="notes-sidebar">
        <button className="app-toolbar-btn" style={{ margin: 8 }} onClick={newNote}>
          <Icon name="file" size={14} /> New Note
        </button>
        <div className="notes-list">
          {notes.map((note) => (
            <button
              key={note.id}
              className="notes-list-item"
              data-active={note.id === activeId}
              onClick={() => setActiveId(note.id)}
            >
              <span className="notes-list-item-title">{note.name}</span>
              <span
                className="notes-list-item-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(note.id);
                }}
                role="button"
                aria-label={`Delete ${note.name}`}
              >
                <Icon name="close" size={12} />
              </span>
            </button>
          ))}
          {notes.length === 0 && <div className="notes-empty">No notes yet.</div>}
        </div>
      </div>
      <div className="notes-editor">
        {active ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                className="notes-title-input"
                value={active.name}
                onChange={(e) => rename(active.id, e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="app-toolbar-btn"
                onClick={() => printTextAsPdf(active.name.replace(/\.[^.]+$/, ""), active.content ?? "")}
                aria-label="Print"
              >
                Print
              </button>
            </div>
            <textarea
              className="notes-textarea"
              placeholder="Start typing…"
              value={active.content ?? ""}
              onChange={(e) => updateContent(active.id, e.target.value)}
            />
          </>
        ) : (
          <div className="notes-empty" style={{ padding: 24 }}>
            Select a note, or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}
