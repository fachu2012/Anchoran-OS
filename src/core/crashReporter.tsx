import { Component, type ReactNode } from "react";
import { logAnchoranError } from "./persist";

interface Props {
  children: ReactNode;
}

interface State {
  crashed: boolean;
}

/**
 * Anchoran's crash safety net for the renderer — replaced the old
 * in-process ErrorBoundary (which rendered its own "Something went
 * wrong" fallback UI + an embedded Terminal right here, in the same
 * broken process). Every real crash now goes through the SAME
 * external watchdog (native/watchdog/Program.cs) and the SAME crash screen
 * (src/boot/WatchdogCrashScreen.tsx) regardless of whether it started
 * as a React render error (caught here) or a main-process crash — one
 * screen, one code path, not two different ones that could drift.
 *
 * So this component's own job shrinks to exactly one thing: the
 * instant a React render throws, report it to the main process
 * (which forwards it to the watchdog and quits this whole instance —
 * see main.ts's anchoran:renderer-fatal-error) and render nothing
 * else. There's nothing to keep working for — main.ts ends this
 * process moments later, and the watchdog relaunches a fresh,
 * separate window already showing the real crash screen.
 */
export class CrashReporter extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    const message = `${error.stack ?? error.message}\n${info.componentStack ?? ""}`;
    logAnchoranError("renderer:react", message);
    if (window.anchoran) window.anchoran.rendererFatalError(error.message || "A rendering error crashed Anchoran.");
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return <div style={{ position: "fixed", inset: 0, background: "#000" }} />;
  }
}

/**
 * Catches errors outside React's own render tree (async code, timers,
 * event handlers) — deliberately kept separate from CrashReporter
 * above and NOT routed to the watchdog: an unhandled rejection from
 * one unrelated background task failing doesn't mean the whole
 * desktop is actually broken the way a React render crash does, so
 * this just logs rather than tearing down the whole session over it.
 */
export function installGlobalErrorHandlers() {
  window.addEventListener("error", (e) => {
    logAnchoranError("renderer:window", e.error ?? e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    logAnchoranError("renderer:promise", e.reason);
  });
}
