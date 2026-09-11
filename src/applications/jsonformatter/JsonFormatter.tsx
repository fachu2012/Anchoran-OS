import { useState } from "react";
import { Icon } from "@/components/Icon";
import { printTextAsPdf } from "@/core/print";
import "@/applications/apps.css";
import "./jsonformatter.css";

export function JsonFormatterApp() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function format(indent: number | null) {
    if (!input.trim()) {
      setOutput("");
      setError(null);
      return;
    }
    try {
      const parsed = JSON.parse(input);
      setOutput(indent === null ? JSON.stringify(parsed) : JSON.stringify(parsed, null, indent));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      setOutput("");
    }
  }

  function copy() {
    if (!output) return;
    navigator.clipboard?.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={() => format(2)}>
          Format
        </button>
        <button className="app-toolbar-btn" onClick={() => format(null)}>
          Minify
        </button>
        <button className="app-toolbar-btn" onClick={copy} disabled={!output}>
          <Icon name="copy" size={14} /> {copied ? "Copied" : "Copy"}
        </button>
        <button className="app-toolbar-btn" onClick={() => printTextAsPdf("JSON", output || input)} disabled={!output && !input}>
          Print
        </button>
      </div>
      <div className="app-content jsonfmt-content">
        <div className="jsonfmt-pane">
          <div className="jsonfmt-pane-label">Input</div>
          <textarea
            className="jsonfmt-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste JSON here…"
            spellCheck={false}
          />
        </div>
        <div className="jsonfmt-pane">
          <div className="jsonfmt-pane-label">Output</div>
          {error ? (
            <div className="jsonfmt-error">{error}</div>
          ) : (
            <textarea className="jsonfmt-textarea" value={output} readOnly spellCheck={false} />
          )}
        </div>
      </div>
    </div>
  );
}
