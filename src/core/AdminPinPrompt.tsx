import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useProfilesStore, type Profile } from "@/core/profilesStore";
import "./adminpin.css";

/**
 * "Run as Administrator" elevation prompt — checks the entered PIN
 * against every admin profile on this PC (not just the owner) and, on
 * a match, hands the matching profile back to the caller. Used by the
 * Terminal's right-click "Run as Administrator" context menu entry.
 */
export function AdminPinPrompt({
  onSuccess,
  onCancel,
}: {
  onSuccess: (admin: Profile) => void;
  onCancel: () => void;
}) {
  const findAdminByPin = useProfilesStore((s) => s.findAdminByPin);
  const hasAnyAdminPin = useProfilesStore((s) => s.profiles.some((p) => p.isAdmin && p.lockPin));
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const match = findAdminByPin(pin);
    if (match) {
      onSuccess(match);
      return;
    }
    setError("Incorrect PIN.");
    setPin("");
  }

  return (
    <div className="adminpin-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="adminpin-panel">
        <div className="adminpin-icon">
          <Icon name="lock" size={18} />
        </div>
        <h2 className="adminpin-title">Administrator permission required</h2>
        <p className="adminpin-desc">
          {hasAnyAdminPin
            ? "Enter the PIN of an administrator account on this PC to open an Administrator Terminal."
            : "No administrator account on this PC has a PIN set, so it can't be verified here. Set one in Settings → Users first."}
        </p>
        <input
          className="adminpin-input"
          type="password"
          inputMode="numeric"
          autoFocus
          disabled={!hasAnyAdminPin}
          placeholder="PIN"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 8));
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && pin.length > 0 && submit()}
        />
        {error && <div className="adminpin-error">{error}</div>}
        <div className="adminpin-actions">
          <button className="app-toolbar-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="app-toolbar-btn" disabled={!hasAnyAdminPin || pin.length === 0} onClick={submit}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
