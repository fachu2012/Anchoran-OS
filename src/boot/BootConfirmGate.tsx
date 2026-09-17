import { useEffect, useRef, useState } from "react";

/**
 * The very first thing anyone sees when Anchoran starts, before
 * BootScreen itself — a fullscreen, terminal/BIOS-style confirmation
 * ("Confirm Anchoran OS startup?") the user has to explicitly answer
 * with y/n every single launch. This is deliberately NOT a Settings
 * toggle and deliberately NOT remembered between launches: since this
 * version, starting Anchoran also takes over the whole display and
 * hides/throttles every other running Windows app (see App.tsx's
 * `useSystemModeStore.getState().start()` call, now unconditional) —
 * a real, disruptive thing to do to whatever the user already had
 * open, so it gets asked, in plain terms, every time, instead of a
 * once-and-forget checkbox somewhere in Settings.
 *
 * Presentation is deliberately cinematic, matching a real BIOS/POST
 * screen rather than an instant cut to the prompt: BOOT_LINES reveal
 * one at a time with their own per-line delay (see each entry's
 * `afterMs` — how long to wait, after the previous line appeared,
 * before this one does), mixing genuine POST-style lines (CPU, memory,
 * BIOS date) with Anchoran's own "subsystem checks", before the y/n
 * prompt appears.
 *
 * Answering is typed, not single-keystroke: only "y"/"n"/Backspace/
 * Enter are accepted while typing (any other key is ignored outright,
 * matching how a real BIOS input field rejects invalid characters
 * instead of complaining about them), Enter submits whatever single
 * character is currently typed, and only Enter can advance — pressing
 * "y" alone does nothing until Enter confirms it. The terminal-style
 * blinking block cursor appears once the prompt is ready for input and
 * keeps blinking continuously (through the "Booting…"/"Closing…" beat
 * that follows Enter, unaffected by focus) — it only ever disappears
 * because this whole screen unmounts, never on its own.
 *
 *   y + Enter -> "Booting Anchoran OS…" beat, then onConfirm() hands
 *                off into Anchoran's normal boot sequence.
 *   n + Enter -> "Closing Anchoran OS…" beat, then a short, deliberately
 *                dramatic black screen, then Anchoran's whole process
 *                exits (window.anchoran.confirmExit()) — the same clean
 *                quit path ErrorBoundary's "Return to Windows" used, no
 *                lingering process, no partial takeover.
 */

const BOOT_LINES: { text: string; afterMs: number }[] = [
  { text: "Anchoran BIOS v3.8.0", afterMs: 0 },
  { text: "Copyright (C) Anchoran Systems. All rights reserved.", afterMs: 350 },
  { text: "", afterMs: 250 },
  { text: "CPU: Generic x64 Processor @ 3.60GHz", afterMs: 450 },
  { text: "Memory Test: 16384MB OK", afterMs: 400 },
  { text: "BIOS Date: 07/14/25   Ver: 3.8.0.A0", afterMs: 350 },
  { text: "", afterMs: 250 },
  { text: "Detecting Boot Device... Anchoran Kernel Bridge", afterMs: 500 },
  { text: "Kernel Bridge................. OK", afterMs: 450 },
  { text: "Display Takeover Subsystem..... OK", afterMs: 350 },
  { text: "Watchdog Service............... OK", afterMs: 350 },
  { text: "", afterMs: 300 },
  { text: "This session, Anchoran OS will take exclusive control of this display.", afterMs: 550 },
  { text: "Every other running Windows application will be hidden and throttled", afterMs: 300 },
  { text: "to near-zero CPU (not closed) for as long as Anchoran OS is running.", afterMs: 300 },
  { text: "", afterMs: 400 },
  { text: "Confirm Anchoran OS startup? [y/n]", afterMs: 450 },
];

// -------------------------------------------------------------------
// Print / timing reference for BOOT_LINES above (kept here so the
// cinematic pacing can be reviewed and tweaked without re-deriving it
// from the array by hand):
//
//   Anchoran BIOS v3.8.0                                            (Después de 0 segundos)
//   Copyright (C) Anchoran Systems. All rights reserved.            (Después de 0.35 segundos)
//                                                                    (Después de 0.25 segundos)
//   CPU: Generic x64 Processor @ 3.60GHz                            (Después de 0.45 segundos)
//   Memory Test: 16384MB OK                                         (Después de 0.4 segundos)
//   BIOS Date: 07/14/25   Ver: 3.8.0.A0                             (Después de 0.35 segundos)
//                                                                    (Después de 0.25 segundos)
//   Detecting Boot Device... Anchoran Kernel Bridge                 (Después de 0.5 segundos)
//   Kernel Bridge................. OK                               (Después de 0.45 segundos)
//   Display Takeover Subsystem..... OK                              (Después de 0.35 segundos)
//   Watchdog Service............... OK                              (Después de 0.35 segundos)
//                                                                    (Después de 0.3 segundos)
//   This session, Anchoran OS will take exclusive control...        (Después de 0.55 segundos)
//   Every other running Windows application will be hidden...       (Después de 0.3 segundos)
//   to near-zero CPU (not closed) for as long as Anchoran...        (Después de 0.3 segundos)
//                                                                    (Después de 0.4 segundos)
//   Confirm Anchoran OS startup? [y/n]                              (Después de 0.45 segundos)
//   > _                              <- blinking cursor, input opens (Después de 0.35 segundos)
//
// Total time from mount to the prompt being ready for input: ~5.85s.
// -------------------------------------------------------------------

type Phase = "revealing" | "awaiting-input" | "booting" | "closing";

export function BootConfirmGate({ onConfirm }: { onConfirm: () => void }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("revealing");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blackout, setBlackout] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keeps this window re-asserting itself to the top of the z-order
  // for as long as this whole screen is up — see main.ts's
  // anchoran:set-boot-gate-active. Live-tested bug: the watchdog's own
  // topmost black "curtain" can win a one-shot topmost fight and sit
  // in front of this screen, covering it entirely — most likely
  // exactly here, before Anchoran's first real ping has had time to
  // reach the watchdog. This only stops the moment the component
  // unmounts (booting into the desktop, or the dramatic exit on "n"),
  // never earlier.
  useEffect(() => {
    window.anchoran?.setBootGateActive(true);
    return () => window.anchoran?.setBootGateActive(false);
  }, []);

  // Reveal BOOT_LINES one at a time, each waiting its own `afterMs`
  // after the previous line, then hand off to the input phase.
  useEffect(() => {
    if (visibleCount >= BOOT_LINES.length) {
      const t = setTimeout(() => setPhase("awaiting-input"), 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisibleCount((n) => n + 1), BOOT_LINES[visibleCount].afterMs);
    return () => clearTimeout(t);
  }, [visibleCount]);

  useEffect(() => {
    if (phase === "awaiting-input") inputRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase !== "closing") return;
    // "Closing Anchoran OS..." shows briefly, then the whole screen
    // cuts to black for the remainder of the 2s dramatic-exit beat
    // before the process actually quits.
    const toBlack = setTimeout(() => setBlackout(true), 700);
    const timer = setTimeout(() => {
      if (window.anchoran) window.anchoran.confirmExit();
      // Outside the real desktop app (e.g. a browser preview) there's
      // no process to exit — leave the black screen up rather than
      // silently doing nothing, since that's the honest end state.
    }, 2000);
    return () => {
      clearTimeout(toBlack);
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "booting") return;
    const timer = setTimeout(() => onConfirm(), 900);
    return () => clearTimeout(timer);
  }, [phase, onConfirm]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      setTyped("");
      setError(null);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === "y" || k === "n") {
      e.preventDefault();
      setTyped(k);
      setError(null);
      return;
    }
    // Anything else (letters, digits, punctuation, arrows...) is
    // silently rejected, same as a real BIOS input field — no typed
    // character, no error noise.
    e.preventDefault();
  }

  function submit() {
    if (typed === "y") {
      setPhase("booting");
      return;
    }
    if (typed === "n") {
      setPhase("closing");
      return;
    }
    setError(typed ? `"${typed}" is not a valid answer — type y or n.` : "Type y or n, then press Enter.");
  }

  const cursorVisible = phase === "awaiting-input" || phase === "booting" || phase === "closing";

  if (blackout) {
    return <div style={{ position: "fixed", inset: 0, background: "#000" }} />;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        color: "#C9D1D9",
        fontFamily: "'Cascadia Code', Consolas, monospace",
        fontSize: 15,
        padding: "48px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        lineHeight: 1.7,
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
        <div key={i} style={{ opacity: line.text === "" ? 0 : i < 2 ? 0.55 : 1, minHeight: line.text === "" ? "1.7em" : undefined }}>
          {line.text || " "}
        </div>
      ))}

      {phase !== "revealing" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ opacity: 0.7 }}>&gt;</span>
          <span>{typed}</span>
          {cursorVisible && (
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 9,
                height: 16,
                background: "#F3F4F6",
                animation: "boot-cursor-blink 1s steps(1) infinite",
              }}
            />
          )}
          <input
            ref={inputRef}
            value=""
            onChange={() => {}}
            onKeyDown={phase === "awaiting-input" ? handleKeyDown : undefined}
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {error && <div style={{ color: "#E5484D", marginTop: 4 }}>{error}</div>}

      {phase === "booting" && <div style={{ marginTop: 14, opacity: 0.85 }}>Booting Anchoran OS...</div>}
      {phase === "closing" && <div style={{ marginTop: 14, opacity: 0.85 }}>Closing Anchoran OS...</div>}

      <style>{`
        @keyframes boot-cursor-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
