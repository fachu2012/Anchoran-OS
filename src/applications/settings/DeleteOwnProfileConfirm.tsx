import { useState, type CSSProperties } from "react";
import { AnchoranLogo } from "@/components/AnchoranLogo";
import { usePreferencesStore } from "@/theme/preferencesStore";
import type { Profile } from "@/core/profilesStore";

const btnBase: CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  border: "1px solid transparent",
  cursor: "pointer",
  fontSize: 13,
};

/**
 * A real, deliberate stop before deleting the profile you're actually
 * signed in as right now — same fullscreen visual weight as
 * UpdateReadyScreen, rather than a browser `window.confirm()` that's
 * just as easy to click through as any other dialog. Deleting your
 * own active profile is different from deleting someone else's: you
 * can't stay logged into the identity you just removed, so this asks
 * for the profile's own PIN (when it has one) and, on confirm, hands
 * back to the caller — which deletes the profile and sends the whole
 * session to the lock screen, never silently switching you into
 * whatever profile happened to be next in the list.
 */
export function DeleteOwnProfileConfirm({
  profile,
  onConfirm,
  onCancel,
}: {
  profile: Profile;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const accentColor = usePreferencesStore((s) => s.accentColor);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requiresPin = !!profile.lockPin;

  function submit() {
    if (requiresPin && pin !== profile.lockPin) {
      setError("Incorrect PIN.");
      setPin("");
      return;
    }
    onConfirm();
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
        animation: "delete-own-profile-in 400ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <AnchoranLogo size={56} color={accentColor} style={{ opacity: 0.92 }} />
      <div style={{ color: "#F3F4F6", fontSize: 16, fontWeight: 300, letterSpacing: 0.4 }}>
        Delete "{profile.name}" — you're signed in as this profile right now
      </div>
      <div style={{ color: "rgba(243,244,246,0.5)", fontSize: 12.5, maxWidth: 380, textAlign: "center" }}>
        This can't be undone. Anchoran will sign you out to the lock screen once it's deleted.
      </div>
      {requiresPin && (
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          placeholder="Confirm your PIN"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 8));
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && pin.length > 0 && submit()}
          style={{
            width: 200,
            textAlign: "center",
            fontSize: 18,
            letterSpacing: 4,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(255,255,255,0.05)",
            color: "#F3F4F6",
          }}
        />
      )}
      {error && <div style={{ color: "#E5484D", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          onClick={onCancel}
          style={{ ...btnBase, border: "1px solid rgba(255,255,255,0.16)", background: "transparent", color: "#F3F4F6" }}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={requiresPin && pin.length === 0}
          style={{ ...btnBase, background: "#D64545", color: "#fff", opacity: requiresPin && pin.length === 0 ? 0.5 : 1 }}
        >
          Delete & sign out
        </button>
      </div>
      <style>{`
        @keyframes delete-own-profile-in {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
