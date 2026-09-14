import { useEffect, useState, type CSSProperties } from "react";
import { AnchoranLogo } from "@/components/AnchoranLogo";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { fetchUpdateInfo } from "@/core/updateInfo";
import { versionLabelFor, ANCHORAN_MAJOR_VERSION } from "@/core/buildNumber";
import { ANCHORAN_VERSION } from "@/core/version";
import { needsLocalAppsRemovalNotice, installedLegacyApps } from "@/core/upgradeAppRemoval";
import { useInstalledAppsStore } from "@/applications/installedAppsStore";

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
  const [updateLabel, setUpdateLabel] = useState<string | null>(null);
  const installedApps = useInstalledAppsStore((s) => s.installed);
  const [localAppsAcknowledged, setLocalAppsAcknowledged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchUpdateInfo(version).then((info) => {
      if (!cancelled && info) setUpdateLabel(info.label);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  // See upgradeAppRemoval.ts: this update crosses the version where
  // every simple utility/game app moved out to standalone Webstore
  // plugins (see CHANGELOG) — shown only when this device actually has
  // one of them installed, and purely informational (no typing "delete"
  // required, unlike needsDataWipeFor's downgrade gate — nothing here
  // blocks the install, it just tells you first instead of surprising
  // you after the restart).
  const removedApps = needsLocalAppsRemovalNotice(ANCHORAN_VERSION, installedApps, version)
    ? installedLegacyApps(installedApps)
    : [];
  const showLocalAppsNotice = removedApps.length > 0 && !localAppsAcknowledged;

  if (showLocalAppsNotice) {
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
          gap: 16,
          background: "#08090D",
          animation: "update-ready-in 400ms cubic-bezier(0.16,1,0.3,1)",
          padding: 24,
        }}
      >
        <AnchoranLogo size={48} color={accentColor} style={{ opacity: 0.92 }} />
        <div style={{ color: "#F3F4F6", fontSize: 15.5, fontWeight: 300, textAlign: "center", maxWidth: 420 }}>
          This update moves Anchoran's built-in utility and game apps to the Webstore
        </div>
        <div style={{ color: "rgba(243,244,246,0.55)", fontSize: 12.5, textAlign: "center", maxWidth: 420 }}>
          The following apps you have installed will be uninstalled as part of this update. You can reinstall an
          updated version of each from the Webstore's Community section afterward.
        </div>
        <div
          style={{
            width: "100%",
            maxWidth: 340,
            maxHeight: 220,
            overflowY: "auto",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            padding: "6px 4px",
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "rgba(243,244,246,0.4)",
              padding: "4px 12px",
            }}
          >
            Anchoran Local Apps
          </div>
          {removedApps.map((app) => (
            <div
              key={app.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                padding: "6px 12px",
                fontSize: 12.5,
                color: "#F3F4F6",
              }}
            >
              <span>{app.title}</span>
              <span style={{ color: "rgba(243,244,246,0.4)" }}>→ {app.movedToPluginTitle}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setLocalAppsAcknowledged(true)}
          style={{ ...btnBase, background: accentColor, color: "#fff", marginTop: 6 }}
        >
          Continue
        </button>
      </div>
    );
  }

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
      <div style={{ textAlign: "center" }}>
        {/* Same title typography as Anchover's own "ANCHORAN OS #" heading. */}
        <div style={{ color: "#F3F4F6", fontSize: 20, fontWeight: 600 }}>ANCHORAN OS {ANCHORAN_MAJOR_VERSION}</div>
        <div style={{ color: "#F3F4F6", fontSize: 16, fontWeight: 300, letterSpacing: 0.4, marginTop: 4 }}>
          {versionLabelFor(version)} is ready to install
        </div>
      </div>
      {updateLabel && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 0.3,
            padding: "3px 10px",
            borderRadius: 999,
            background: `color-mix(in srgb, ${accentColor} 22%, transparent)`,
            color: accentColor,
          }}
        >
          {updateLabel}
        </span>
      )}

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
