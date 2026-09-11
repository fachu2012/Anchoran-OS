import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./typingtest.css";

const SAMPLES = [
  "The quick brown fox jumps over the lazy dog while the sun sets behind the hills.",
  "Anchoran keeps every window, file and setting exactly where you left them.",
  "Typing quickly and accurately is a skill that improves with steady practice.",
  "A calm mind and a light touch on the keyboard will get you further than speed alone.",
  "Small consistent habits compound into results that feel impossible at the start.",
];

function pickSample() {
  return SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
}

export function TypingTestApp() {
  const [sample, setSample] = useState(pickSample);
  const [input, setInput] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [sample]);

  function onChange(value: string) {
    if (finishedAt) return;
    if (!startedAt && value.length > 0) setStartedAt(Date.now());
    setInput(value);
    if (value === sample) setFinishedAt(Date.now());
  }

  function restart() {
    setSample(pickSample());
    setInput("");
    setStartedAt(null);
    setFinishedAt(null);
  }

  const elapsedMinutes = startedAt ? ((finishedAt ?? Date.now()) - startedAt) / 60000 : 0;
  const wordsTyped = input.trim().length > 0 ? input.trim().split(/\s+/).length : 0;
  const wpm = elapsedMinutes > 0 ? Math.round(wordsTyped / elapsedMinutes) : 0;
  let correctChars = 0;
  for (let i = 0; i < input.length; i++) if (input[i] === sample[i]) correctChars++;
  const accuracy = input.length > 0 ? Math.round((correctChars / input.length) * 100) : 100;

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={restart}>
          <Icon name="restart" size={14} /> New text
        </button>
        <div className="typing-stats">
          {finishedAt ? `${wpm} WPM · ${accuracy}% accuracy` : startedAt ? "Typing…" : "Start typing to begin"}
        </div>
      </div>
      <div className="app-content typing-content">
        <div className="typing-sample">
          {sample.split("").map((ch, i) => {
            const typed = input[i];
            const state = typed === undefined ? "pending" : typed === ch ? "correct" : "wrong";
            return (
              <span key={i} className="typing-char" data-state={state}>
                {ch}
              </span>
            );
          })}
        </div>
        <textarea
          ref={inputRef}
          className="typing-input"
          value={input}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Start typing the text above…"
          rows={3}
          disabled={!!finishedAt}
        />
        {finishedAt && (
          <div className="typing-result">
            Done! {wpm} words per minute, {accuracy}% accuracy.
          </div>
        )}
      </div>
    </div>
  );
}
