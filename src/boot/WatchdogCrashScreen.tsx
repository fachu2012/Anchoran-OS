import { useState } from "react";
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
 * Deliberately styled close to Windows' own "stop" screen in its
 * LAYOUT and FRAMING (the big ":(", the plain-language headline, the
 * technical detail kept small below it) — the one screen every Windows
 * user already recognizes as "the machine crashed, here's what to do",
 * so this reads the same way on sight rather than needing to be
 * learned. The background stays Anchoran's own dark theme color
 * (#08090D, same as every other full-screen Anchoran moment — boot,
 * shutdown, update) rather than Windows' actual blue — this is
 * Anchoran's own crash screen, not an impression of Windows itself.
 * The Administrator Terminal is real and
 * already elevated, but — unlike the old always-visible panel — stays
 * collapsed until "Open Anchoran Terminal" is clicked, matching that
 * same real-BSOD framing: the plain crash summary is what everyone
 * sees first, the recovery tooling is one click away for whoever
 * actually needs it. It deliberately asks for no PIN — by the time
 * anyone reaches this screen, Anchoran itself is already down;
 * gatekeeping the one tool that can actually help diagnose or fix
 * things behind a PIN prompt would be exactly backwards, the same
 * reasoning a real OS's own recovery console uses.
 */
export function WatchdogCrashScreen({ message }: { message: string }) {
  const [terminalOpen, setTerminalOpen] = useState(false);

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
        justifyContent: terminalOpen ? "flex-start" : "center",
        overflowY: "auto",
        gap: 20,
        fontFamily: "'Segoe UI', Inter, system-ui, sans-serif",
        padding: "48px 24px",
        textAlign: "left",
      }}
    >
      <div style={{ width: "min(640px, 92vw)" }}>
        <div style={{ fontSize: 92, fontWeight: 300, lineHeight: 1 }}>:(</div>
        <div style={{ fontSize: 22, fontWeight: 400, marginTop: 18, lineHeight: 1.4 }}>
          Anchoran ran into a problem and needs to restart.
        </div>
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 14, lineHeight: 1.6 }}>
          We're not collecting any of this automatically — nothing leaves this PC. The error's already
          logged locally, and the Administrator Terminal below can still poke at things (real processes,
          logs, the disk) if you need to before you restart or exit.
        </div>
        <div
          style={{
            fontSize: 12.5,
            opacity: 0.75,
            marginTop: 18,
            fontFamily: "'Cascadia Code', Consolas, monospace",
          }}
        >
          {message}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
          <button
            onClick={() => setTerminalOpen((v) => !v)}
            style={{
              padding: "9px 18px",
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.5)",
              background: terminalOpen ? "rgba(255,255,255,0.16)" : "transparent",
              color: "#FFFFFF",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {terminalOpen ? "Close Anchoran Terminal" : "Open Anchoran Terminal"}
          </button>
          <button
            onClick={() => window.anchoran?.crashRestart()}
            style={{
              padding: "9px 18px",
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.5)",
              background: "transparent",
              color: "#FFFFFF",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Auto-Repair Anchoran
          </button>
          <button
            onClick={() => window.anchoran?.crashForceClose()}
            style={{
              padding: "9px 18px",
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.5)",
              background: "transparent",
              color: "#FFFFFF",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Exit Anchoran
          </button>
        </div>
      </div>

      {terminalOpen && (
        <div
          style={{
            width: "min(720px, 92vw)",
            height: 320,
            marginTop: 6,
            marginBottom: 24,
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.35)",
            overflow: "hidden",
            boxShadow: "0 20px 48px rgba(0,0,0,0.35)",
            background: "#08090D",
          }}
        >
          <div
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 500,
              color: "rgba(255,255,255,0.7)",
              background: "rgba(255,255,255,0.06)",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            Administrator Terminal
          </div>
          <div style={{ height: "calc(100% - 33px)" }}>
            <TerminalConsole admin canExitAdmin={false} greeting='Administrator Terminal (crash diagnostics). Type "help" to get started.' />
          </div>
        </div>
      )}
    </div>
  );
}
