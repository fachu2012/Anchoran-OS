import { useMemo, useState } from "react";
import "@/applications/apps.css";
import "./wordcounter.css";

const WORDS_PER_MINUTE = 200;

export function WordCounterApp() {
  const [text, setText] = useState("");

  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, "").length;
    const sentences = trimmed ? (trimmed.match(/[.!?]+(\s|$)/g) || []).length || (trimmed ? 1 : 0) : 0;
    const paragraphs = trimmed ? trimmed.split(/\n+/).filter((p) => p.trim().length > 0).length : 0;
    const readingTime = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
    return { words, characters, charactersNoSpaces, sentences, paragraphs, readingTime };
  }, [text]);

  return (
    <div className="app-root">
      <div className="app-content wordcounter-content">
        <textarea
          className="wordcounter-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start typing or paste your text…"
        />
        <div className="wordcounter-stats">
          <div className="wordcounter-stat">
            <span className="wordcounter-stat-value">{stats.words}</span>
            <span className="wordcounter-stat-label">Words</span>
          </div>
          <div className="wordcounter-stat">
            <span className="wordcounter-stat-value">{stats.characters}</span>
            <span className="wordcounter-stat-label">Characters</span>
          </div>
          <div className="wordcounter-stat">
            <span className="wordcounter-stat-value">{stats.charactersNoSpaces}</span>
            <span className="wordcounter-stat-label">No spaces</span>
          </div>
          <div className="wordcounter-stat">
            <span className="wordcounter-stat-value">{stats.sentences}</span>
            <span className="wordcounter-stat-label">Sentences</span>
          </div>
          <div className="wordcounter-stat">
            <span className="wordcounter-stat-value">{stats.paragraphs}</span>
            <span className="wordcounter-stat-label">Paragraphs</span>
          </div>
          <div className="wordcounter-stat">
            <span className="wordcounter-stat-value">{stats.readingTime}m</span>
            <span className="wordcounter-stat-label">Reading time</span>
          </div>
        </div>
      </div>
    </div>
  );
}
