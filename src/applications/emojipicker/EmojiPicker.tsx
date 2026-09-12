import { useState } from "react";
import { EMOJI_CATEGORIES } from "./emojiData";
import "@/applications/apps.css";
import "./emojipicker.css";

export function EmojiPickerApp() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(emoji: string) {
    navigator.clipboard?.writeText(emoji);
    setCopied(emoji);
    setTimeout(() => setCopied((c) => (c === emoji ? null : c)), 1000);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <span style={{ fontSize: 12.5, color: "var(--anchoran-text-secondary)" }}>Click an emoji to copy it</span>
        {copied && <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--anchoran-accent)" }}>Copied {copied}</span>}
      </div>
      <div className="app-content emojipicker-content">
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.label} className="emojipicker-section">
            <div className="emojipicker-section-title">{cat.label}</div>
            <div className="emojipicker-grid">
              {cat.emoji.map((e) => (
                <button key={e} className="emojipicker-btn" onClick={() => copy(e)} title={e}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
