import { Icon, type IconName } from "@/components/Icon";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { useNotificationStore } from "@/notifications/notificationStore";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useSystemStatus } from "./systemStatus";
import { useVolumeMixerStore, MIXER_APP_IDS } from "./volumeMixerStore";
import { APP_REGISTRY } from "@/applications/registry";
import { useEnergyProfileStore, POWER_PROFILE_LABELS, type PowerProfile } from "@/theme/energyProfileStore";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 32,
        height: 18,
        borderRadius: 9,
        border: "none",
        cursor: "pointer",
        background: checked ? "var(--anchoran-accent)" : "var(--anchoran-border-strong)",
        position: "relative",
        transition: "background 150ms ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 16 : 2,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 150ms ease",
        }}
      />
    </button>
  );
}

function PowerProfileRow() {
  const profile = useEnergyProfileStore((s) => s.profile);
  const setProfile = useEnergyProfileStore((s) => s.setProfile);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12.5 }}>Power profile</span>
      <select
        value={profile}
        onChange={(e) => setProfile(e.target.value as PowerProfile)}
        style={{
          border: "1px solid var(--anchoran-border)",
          borderRadius: 6,
          padding: "3px 6px",
          background: "var(--anchoran-bg)",
          color: "var(--anchoran-text-primary)",
          fontSize: 12,
        }}
      >
        {(Object.keys(POWER_PROFILE_LABELS) as PowerProfile[]).map((p) => (
          <option key={p} value={p}>
            {POWER_PROFILE_LABELS[p]}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Quick Settings: a single flyout for the everyday toggles that would
 * otherwise mean opening the full Settings app — volume, brightness,
 * Night Light, Focus (Do Not Disturb) and Battery Saver — reached by
 * clicking any icon in the taskbar's system tray, the same role this
 * panel plays in a real desktop OS.
 */
export function QuickSettingsPanel({ onClose }: { onClose: () => void }) {
  const prefs = usePreferencesStore();
  const doNotDisturb = useNotificationStore((s) => s.doNotDisturb);
  const focusMode = useWindowStore((s) => s.focusMode);
  const setFocusMode = useWindowStore((s) => s.setFocusMode);
  const setDoNotDisturb = useNotificationStore((s) => s.setDoNotDisturb);
  const openApp = useWindowStore((s) => s.openApp);
  const status = useSystemStatus();
  const batteryPercent = Math.round(status.batteryLevel * 100);
  const getLevel = useVolumeMixerStore((s) => s.getLevel);
  const setVolume = useVolumeMixerStore((s) => s.setVolume);
  const setMuted = useVolumeMixerStore((s) => s.setMuted);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 690 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 72,
          right: 16,
          width: 300,
          background: "var(--anchoran-surface-overlay)",
          backdropFilter: "blur(24px) saturate(1.5)",
          border: "1px solid var(--anchoran-border)",
          borderRadius: "var(--anchoran-radius-lg)",
          boxShadow: "var(--anchoran-shadow-window)",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          animation: "panel-in var(--anchoran-duration-base) var(--anchoran-ease-out)",
          transformOrigin: "bottom right",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: "var(--anchoran-radius-md)",
              background: "var(--anchoran-border)",
            }}
          >
            <Icon name="wifi" size={15} style={{ opacity: status.online ? 1 : 0.4 }} />
            <span style={{ fontSize: 12 }}>{status.online ? "Online" : "Offline"}</span>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: "var(--anchoran-radius-md)",
              background: "var(--anchoran-border)",
            }}
          >
            <Icon name="battery" size={15} />
            <span style={{ fontSize: 12 }}>
              {status.batterySupported ? `${batteryPercent}%${status.charging ? " ⚡" : ""}` : "N/A"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="volume" size={15} /> Volume
            </span>
            <Toggle checked={prefs.soundEnabled} onChange={prefs.setSoundEnabled} />
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={prefs.soundVolume}
            disabled={!prefs.soundEnabled}
            onChange={(e) => prefs.setSoundVolume(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "var(--anchoran-text-secondary)" }}>App volume</span>
          {MIXER_APP_IDS.map((appId) => {
            const level = getLevel(appId);
            const app = APP_REGISTRY[appId];
            return (
              <div key={appId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name={app.icon as IconName} size={14} style={{ flexShrink: 0, opacity: level.muted ? 0.4 : 1 }} />
                <span style={{ fontSize: 12, width: 78, flexShrink: 0 }}>{app.title}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={level.volume}
                  disabled={level.muted}
                  onChange={(e) => setVolume(appId, Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={() => setMuted(appId, !level.muted)}
                  aria-label={level.muted ? "Unmute" : "Mute"}
                  style={{ border: "none", background: "transparent", color: "var(--anchoran-text-secondary)", cursor: "pointer", flexShrink: 0 }}
                >
                  <Icon name="volume" size={13} style={{ opacity: level.muted ? 0.4 : 1 }} />
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 12.5 }}>Brightness</span>
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.05}
            value={prefs.brightness}
            onChange={(e) => prefs.setBrightness(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5 }}>Focus (Do Not Disturb)</span>
            <Toggle checked={doNotDisturb} onChange={setDoNotDisturb} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5 }}>Night Light</span>
            <Toggle checked={prefs.nightLightEnabled} onChange={prefs.setNightLightEnabled} />
          </div>
          <PowerProfileRow />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5 }}>Window Spotlight (dim other windows)</span>
            <Toggle checked={focusMode} onChange={setFocusMode} />
          </div>
        </div>

        <button
          className="app-toolbar-btn"
          onClick={() => {
            openApp("settings");
            onClose();
          }}
        >
          All settings
        </button>
      </div>
    </div>
  );
}
