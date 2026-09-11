const ANCHORAN_LOGO = new URL("../../assets/logo/anchoran-logo.svg", import.meta.url).href;

/**
 * Shown, fullscreen and in the same visual language as boot/shutdown,
 * once electron-updater has finished downloading an update in the
 * background. This is the "update" counterpart to AnchoranSetup's
 * install screen — same style, different content — but implemented as
 * an overlay inside Anchoran itself rather than by relaunching
 * AnchoranSetup, since the update is already downloaded and all that's
 * left is a restart-and-install electron-updater already knows how to
 * do (see ShutdownScreen's "update" mode for the restart animation).
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
      <img src={ANCHORAN_LOGO} alt="" width={56} height={56} style={{ opacity: 0.92 }} />
      <div style={{ color: "#F3F4F6", fontSize: 16, fontWeight: 300, letterSpacing: 0.4 }}>
        Anchoran OS {version} is ready to install
      </div>
      <div style={{ color: "rgba(243,244,246,0.5)", fontSize: 12.5, maxWidth: 360, textAlign: "center" }}>
        Anchoran will restart to finish installing this update.
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          onClick={onLater}
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
          Later
        </button>
        <button
          onClick={onInstallNow}
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            border: "1px solid transparent",
            background: "#5B84E8",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Restart & Update
        </button>
      </div>
      <style>{`
        @keyframes update-ready-in {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
