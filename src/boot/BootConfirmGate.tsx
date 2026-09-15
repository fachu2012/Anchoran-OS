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
 *   y -> onConfirm(); Anchoran proceeds into its normal boot sequence.
 *   n -> a short, deliberately dramatic black screen, then Anchoran's
 *        whole process exits (window.anchoran.confirmExit()) — the
 *        same clean quit path ErrorBoundary's "Return to Windows"
 *        used, no lingering process, no partial takeover.
 */
export function BootConfirmGate({ onConfirm }: { onConfirm: () => void }) {
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!declined) return;
    const timer = setTimeout(() => {
      if (window.anchoran) window.anchoran.confirmExit();
      // Outside the real desktop app (e.g. a browser preview) there's
      // no process to exit — leave the black screen up rather than
      // silently doing nothing, since that's the honest end state.
    }, 2000);
    return () => clearTimeout(timer);
  }, [declined]);

  function answer(raw: string) {
    const a = raw.trim().toLowerCase();
    if (a === "y" || a === "yes" || a === "s" || a === "si" || a === "sí") {
      onConfirm();
      return;
    }
    if (a === "n" || a === "no") {
      setDeclined(true);
      return;
    }
    setError(`"${raw}" is not a valid answer — type y or n.`);
  }

  if (declined) {
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
      <div style={{ opacity: 0.55, marginBottom: 18 }}>Anchoran OS — Startup Confirmation</div>
      <div>This session, Anchoran OS will take exclusive control of this display.</div>
      <div>Every other running Windows application will be hidden and throttled</div>
      <div>to near-zero CPU (not closed) for as long as Anchoran OS is running.</div>
      <div style={{ marginTop: 14 }}>Confirm Anchoran OS startup? [y/n]</div>
      {error && <div style={{ color: "#E5484D", marginTop: 4 }}>{error}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <span style={{ opacity: 0.7 }}>&gt;</span>
        <input
          ref={inputRef}
          autoFocus
          value=""
          onChange={() => {}}
          onKeyDown={(e) => {
            if (e.key === "Enter") return;
            if (e.key.length === 1) {
              e.preventDefault();
              answer(e.key);
            }
          }}
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#C9D1D9",
            fontFamily: "inherit",
            fontSize: "inherit",
            width: 4,
            caretColor: "#C9D1D9",
          }}
        />
      </div>
    </div>
  );
}
