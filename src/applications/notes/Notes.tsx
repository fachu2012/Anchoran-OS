import { useEffect, useState } from "react";
import "@/applications/apps.css";

const STORAGE_KEY = "anchoran.notes.scratch.v1";

export function NotesApp() {
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      setText(localStorage.getItem(STORAGE_KEY) ?? "");
    } catch {
      // ignore
    }
  }, []);

  function onChange(value: string) {
    setText(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // best-effort persistence only
    }
  }

  return (
    <div className="app-root">
      <div className="app-content">
        <textarea
          className="notes-textarea"
          placeholder="Start typing…"
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
