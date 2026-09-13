import { AnchoranLogo } from "@/components/AnchoranLogo";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { useProfilesStore } from "@/core/profilesStore";
import { ANCHORAN_VERSION } from "@/core/version";
import { useWindowStore } from "@/windowmanager/windowStore";
import "@/applications/apps.css";

/**
 * "Anchover" — Anchoran's own equivalent of Windows' `winver`: a small,
 * fixed-size "what build is this" screen. Deliberately not listed in
 * the Launcher's browse-all or search-by-substring (see
 * hiddenFromLauncher in apps.json/types.ts) — it's still a real,
 * ordinary app otherwise, just one you have to already know the exact
 * name of to find, the same way winver isn't pinned to the Start menu.
 */
export function AnchoverApp({ windowId }: { windowId?: string }) {
  const username = usePreferencesStore((s) => s.username);
  const owner = useProfilesStore((s) => s.profiles.find((p) => p.isOwner));
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const majorVersion = ANCHORAN_VERSION.split(".")[0];

  return (
    <div
      className="app-root"
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        gap: 14,
      }}
    >
      <AnchoranLogo size={52} color="var(--anchoran-accent)" />
      <div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>ANCHORAN OS {majorVersion}</div>
        <div style={{ fontSize: 12.5, color: "var(--anchoran-text-secondary)", marginTop: 2 }}>Fachun Anchoran</div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--anchoran-text-secondary)" }}>Version {ANCHORAN_VERSION}</div>
      <div
        style={{
          borderTop: "1px solid var(--anchoran-border)",
          width: "100%",
          maxWidth: 280,
          paddingTop: 14,
          fontSize: 11.5,
          color: "var(--anchoran-text-secondary)",
          lineHeight: 1.6,
        }}
      >
        © Fachun Corporations. All rights reserved.
        <br />
        This product is licensed to {owner?.name || username || "this PC"}.
      </div>
      {windowId && (
        <button className="app-toolbar-btn" style={{ marginTop: 4 }} onClick={() => closeWindow(windowId)}>
          OK
        </button>
      )}
    </div>
  );
}
