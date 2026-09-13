import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./coderunner.css";

const RENDERABLE_EXT = new Set([".html", ".htm"]);

type RunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "ran"; stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }
  | { status: "rendered"; html: string }
  | { status: "unsupported"; content: string | null }
  | { status: "error"; message: string };

function extOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot < 0 ? "" : path.slice(dot).toLowerCase();
}

/**
 * Files' default for opening a code file: runs it with whatever
 * interpreter is on this PC's own PATH (see the "anchoran:run-code"
 * handler in electron/main.ts) and shows the output, instead of
 * opening the file for editing — the same expectation a real IDE's
 * "Run" button sets. ".html"/".htm" get rendered live in a sandboxed
 * frame instead, since there's no interpreter to run markup through.
 * File types Code Runner has no way to execute (JSON, CSS, other
 * config/data formats, and compiled languages needing their own
 * toolchain) fall back to a plain read-only view of the file, with a
 * clear note — never a silent failure. Editing is always one
 * right-click ("Edit as Text") away, regardless of what happens here.
 */
export function CodeRunnerApp({ openPath }: { openPath?: string }) {
  const [state, setState] = useState<RunState>({ status: "idle" });
  const [runToken, setRunToken] = useState(0);

  useEffect(() => {
    if (!openPath || !window.anchoran) return;
    let cancelled = false;
    const ext = extOf(openPath);

    async function run() {
      if (RENDERABLE_EXT.has(ext)) {
        const result = await window.anchoran!.fsReadTextFile(openPath!);
        if (cancelled) return;
        setState("error" in result ? { status: "error", message: result.error } : { status: "rendered", html: result.content });
        return;
      }
      setState({ status: "running" });
      const result = await window.anchoran!.runCode(openPath!);
      if (cancelled) return;
      if ("unsupported" in result) {
        const text = await window.anchoran!.fsReadTextFile(openPath!);
        if (cancelled) return;
        setState({ status: "unsupported", content: "content" in text ? text.content : null });
      } else if ("error" in result) {
        setState({ status: "error", message: result.error });
      } else {
        setState({ status: "ran", ...result });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [openPath, runToken]);

  const fileName = openPath?.split(/[\\/]/).pop() ?? "Untitled";

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <Icon name="jsonFormatter" size={14} />
        <span className="coderunner-filename">{fileName}</span>
        <div style={{ flex: 1 }} />
        <button
          className="app-toolbar-btn"
          data-op
          disabled={state.status === "running" || !openPath}
          onClick={() => setRunToken((t) => t + 1)}
        >
          {state.status === "running" ? "Running…" : "Run again"}
        </button>
      </div>
      <div className="app-content coderunner-content">
        {!openPath && <div className="coderunner-empty">No file to run.</div>}

        {state.status === "running" && <div className="coderunner-empty">Running {fileName}…</div>}

        {state.status === "rendered" && (
          <iframe className="coderunner-frame" title={fileName} srcDoc={state.html} sandbox="allow-scripts" />
        )}

        {state.status === "ran" && (
          <div className="coderunner-output">
            <div className="coderunner-output-meta">
              Exit code: {state.exitCode ?? "—"}
              {state.timedOut && <span className="coderunner-timedout"> · stopped after 15s (still running)</span>}
            </div>
            {state.stdout && (
              <>
                <div className="coderunner-output-label">Output</div>
                <pre className="coderunner-pre">{state.stdout}</pre>
              </>
            )}
            {state.stderr && (
              <>
                <div className="coderunner-output-label coderunner-output-label-error">Errors</div>
                <pre className="coderunner-pre coderunner-pre-error">{state.stderr}</pre>
              </>
            )}
            {!state.stdout && !state.stderr && <div className="coderunner-empty">Ran with no output.</div>}
          </div>
        )}

        {state.status === "unsupported" && (
          <div className="coderunner-output">
            <div className="coderunner-note">
              Code Runner doesn't know how to run {extOf(fileName)} files yet — showing the file's contents instead.
              Use "Edit as Text" from Files' right-click menu to change it.
            </div>
            {state.content !== null && <pre className="coderunner-pre">{state.content}</pre>}
          </div>
        )}

        {state.status === "error" && <div className="coderunner-error">{state.message}</div>}
      </div>
    </div>
  );
}
