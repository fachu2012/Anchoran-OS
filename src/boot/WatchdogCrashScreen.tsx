import { TerminalConsole } from "@/applications/terminal/TerminalConsole";

/**
 * Anchoran's own "something went badly wrong" screen — shown in a
 * fresh, separate window the crash watchdog (native/watchdog/Program.cs)
 * spawns after detecting Anchoran died or stopped responding, whether
 * that was a main-process crash (an uncaught exception, even one
 * during module load — the exact class the old in-process
 * ErrorBoundary could never have caught, since it lived in the very
 * process that died) or a React render crash reported through
 * CrashReporter (src/core/crashReporter.tsx). One screen, one code
 * path, no matter which kind of crash it was.
 *
 * The Terminal below is real, already in Administrator mode, and
 * deliberately asks for no PIN — by the time anyone reaches this
 * screen, Anchoran itself is already down; gatekeeping the one tool
 * that can actually help diagnose or fix things behind a PIN prompt
 * would be exactly backwards, the same reasoning a real OS's own
 * recovery console uses.
 */
export function WatchdogCrashScreen({ message }: { message: string }) {
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
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 300 }}>Anchoran OS stopped working.</div>
      <div style={{ fontSize: 12.5, opacity: 0.6, maxWidth: 480 }}>{message}</div>
      <div style={{ fontSize: 12.5, opacity: 0.6, maxWidth: 480 }}>
        The error was logged. The Administrator Terminal below is real and can still poke at
        things (real processes, logs, the disk) if you need to before you restart or force close.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => window.anchoran?.crashRestart()}
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "transparent",
            color: "#F3F4F6",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Restart Anchoran
        </button>
        <button
          onClick={() => window.anchoran?.crashForceClose()}
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            border: "1px solid rgba(229,72,77,0.4)",
            background: "transparent",
            color: "#E5484D",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Force close Anchoran
        </button>
      </div>

      {/*
        Same deliberately chrome-less diagnostic panel the old
        ErrorBoundary used — no resize/minimize/maximize/close, this
        isn't a real Anchoran window, just a fixed panel on this one
        screen.
      */}
      <div
        style={{
          width: "min(720px, 92vw)",
          height: 320,
          marginTop: 6,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.12)",
          overflow: "hidden",
          boxShadow: "0 20px 48px rgba(0,0,0,0.4)",
          textAlign: "left",
        }}
      >
        <div
          style={{
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(255,255,255,0.7)",
            background: "rgba(255,255,255,0.04)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          Administrator Terminal
        </div>
        <div style={{ height: "calc(100% - 33px)" }}>
          <TerminalConsole admin canExitAdmin={false} greeting='Administrator Terminal (crash diagnostics). Type "help" to get started.' />
        </div>
      </div>
    </div>
  );
}
