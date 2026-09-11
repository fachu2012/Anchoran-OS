import { Component, type ReactNode } from "react";
import { logAnchoranError } from "./persist";
import { playErrorSound } from "./sound";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Anchoran's crash safety net for the renderer. Instead of a React
 * error taking down the entire desktop to a blank window, it's caught
 * here, logged to Anchoran's own log file (see electron/main.ts —
 * logs/anchoran.log), and shown as a recoverable screen the user can
 * dismiss to get back to the desktop. Errors outside React's render
 * tree (async code, event handlers) are caught separately via
 * window.onerror / onunhandledrejection, wired in main.tsx.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    logAnchoranError("renderer:react", `${error.stack ?? error.message}\n${info.componentStack ?? ""}`);
    playErrorSound();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#08090D",
          color: "#F3F4F6",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          zIndex: 5000,
          fontFamily: "Inter, system-ui, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 300 }}>Something went wrong in Anchoran.</div>
        <div style={{ fontSize: 12.5, opacity: 0.6, maxWidth: 480 }}>
          The error was logged. You can try to recover the desktop below.
        </div>
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            marginTop: 8,
            padding: "9px 18px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "transparent",
            color: "#F3F4F6",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Return to Anchoran
        </button>
      </div>
    );
  }
}

/** Catches errors outside React's own render tree (async code, timers, event handlers). */
export function installGlobalErrorHandlers() {
  window.addEventListener("error", (e) => {
    logAnchoranError("renderer:window", e.error ?? e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    logAnchoranError("renderer:promise", e.reason);
  });
}
