import { useState, type CSSProperties } from "react";
import { AnchoranLogo } from "@/components/AnchoranLogo";
import { usePreferencesStore } from "@/theme/preferencesStore";

const btnBase: CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  border: "1px solid transparent",
  cursor: "pointer",
  fontSize: 13,
};

/**
 * Shown, fullscreen and in the same visual language as boot/shutdown,
 * once electron-updater has finished downloading an update in the
 * background. Choosing to update asks for confirmation first ("Update
 * now?"), then hands off to UpdateTheater for the Windows-Update-style
 * "working on updates" sequence before the real, silent install runs.
 */
export function UpdateReadyScreen({
  version,
  onInstallNow,
  onLater,
}: {
  version: string;
  onInstallNow: () => void;
  onLater: () => void;
}) {
  const accentColor = usePreferencesStore((s) => s.accentColor);
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1900,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        background: "#08090D",
        animation: "update-ready-in 400ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <AnchoranLogo size={56} color={accentColor} style={{ opacity: 0.92 }} />
      <div style={{ color: "#F3F4F6", fontSize: 16, fontWeight: 300, letterSpacing: 0.4 }}>
        Anchoran OS {version} is ready to install
      </div>

      {!confirming ? (
        <>
          <div style={{ color: "rgba(243,244,246,0.5)", fontSize: 12.5, maxWidth: 360, textAlign: "center" }}>
            Anchoran will restart to finish installing this update.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button
              onClick={onLater}
              style={{ ...btnBase, border: "1px solid rgba(255,255,255,0.16)", background: "transparent", color: "#F3F4F6" }}
            >
              Later
            </button>
            <button
              onClick={() => setConfirming(true)}
              style={{ ...btnBase, background: accentColor, color: "#fff" }}
            >
              Restart & Update
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ color: "rgba(243,244,246,0.5)", fontSize: 12.5 }}>Update now?</div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button
              onClick={() => setConfirming(false)}
              style={{ ...btnBase, border: "1px solid rgba(255,255,255,0.16)", background: "transparent", color: "#F3F4F6" }}
            >
              Cancel
            </button>
            <button onClick={onInstallNow} style={{ ...btnBase, background: accentColor, color: "#fff" }}>
              Yes, update
            </button>
          </div>
        </>
      )}
      <style>{`
        @keyframes update-ready-in {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
