import { useMemo, useState } from "react";
import { diffLines } from "./diff";
import "@/applications/apps.css";
import "./textdiff.css";

export function TextDiffApp() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [showDiff, setShowDiff] = useState(false);

  const diff = useMemo(() => (showDiff ? diffLines(left, right) : []), [showDiff, left, right]);
  const added = diff.filter((d) => d.op === "add").length;
  const removed = diff.filter((d) => d.op === "remove").length;

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={() => setShowDiff(true)}>
          Compare
        </button>
        {showDiff && (
          <button className="app-toolbar-btn" onClick={() => setShowDiff(false)}>
            Edit
          </button>
        )}
        {showDiff && (
          <span style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>
            +{added} / -{removed}
          </span>
        )}
      </div>
      <div className="app-content textdiff-content">
        {!showDiff ? (
          <div className="textdiff-panes">
            <textarea
              className="textdiff-textarea"
              placeholder="Original text…"
              value={left}
              onChange={(e) => setLeft(e.target.value)}
            />
            <textarea
              className="textdiff-textarea"
              placeholder="Changed text…"
              value={right}
              onChange={(e) => setRight(e.target.value)}
            />
          </div>
        ) : (
          <div className="textdiff-result">
            {diff.map((line, i) => (
              <div key={i} className="textdiff-line" data-op={line.op}>
                <span className="textdiff-marker">{line.op === "add" ? "+" : line.op === "remove" ? "-" : " "}</span>
                <span className="textdiff-text">{line.text || " "}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
