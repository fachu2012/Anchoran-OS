import { useEffect, useState, type CSSProperties } from "react";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { useNotificationStore } from "@/notifications/notificationStore";
import { ANCHORAN_VERSION } from "@/core/version";
import { WALLPAPERS } from "@/desktop/wallpapers";
import { playNotificationSound } from "@/core/sound";
import { useUpdateHistoryStore } from "@/core/updateHistory";
import { useSystemModeStore } from "@/desktop/systemModeStore";
import { useProfilesStore } from "@/core/profilesStore";
import { AnchoranLogo } from "@/components/AnchoranLogo";
import { AnchoranFilePicker } from "@/core/AnchoranFilePicker";
import { useDefaultAppsStore } from "@/core/defaultAppsStore";
import "@/applications/apps.css";

const DEFAULT_AVATAR = new URL("../../../assets/avatar/default-avatar.png", import.meta.url).href;
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"];


const SECTIONS = [
  "Appearance",
  "Personalization",
  "Display",
  "Sound",
  "Network",
  "Notifications",
  "Users",
  "Privacy",
  "System",
  "Shortcuts",
  "System Mode",
  "Updater",
] as const;

const ACCENTS = ["#6E9BF7", "#1E3A8A", "#0F766E", "#7C3AED", "#B45309", "#94A3B8"];

// A lightweight "find a setting" index — enough to jump to the right
// section without building a full per-row search across every control.
const SETTINGS_INDEX: { label: string; section: (typeof SECTIONS)[number] }[] = [
  { label: "Theme (Light/Dark)", section: "Appearance" },
  { label: "Accent color", section: "Appearance" },
  { label: "Animations", section: "Appearance" },
  { label: "Wallpaper", section: "Personalization" },
  { label: "Custom wallpaper", section: "Personalization" },
  { label: "Interface scale", section: "Display" },
  { label: "Monitor / Display", section: "Display" },
  { label: "Volume", section: "Sound" },
  { label: "Volume mixer", section: "Sound" },
  { label: "Network status", section: "Network" },
  { label: "Notifications", section: "Notifications" },
  { label: "Profiles", section: "Users" },
  { label: "Profile picture / Avatar", section: "Users" },
  { label: "Username", section: "Users" },
  { label: "PIN / Lock screen", section: "Users" },
  { label: "Auto-lock", section: "Users" },
  { label: "Privacy", section: "Privacy" },
  { label: "Backup / Export data", section: "System" },
  { label: "Import data", section: "System" },
  { label: "Reset Anchoran", section: "System" },
  { label: "Default apps", section: "System" },
  { label: "Keyboard shortcuts", section: "Shortcuts" },
  { label: "System Mode", section: "System Mode" },
  { label: "Check for updates", section: "Updater" },
  { label: "Update history", section: "Updater" },
];

const inputStyle: CSSProperties = {
  background: "var(--anchoran-bg)",
  border: "1px solid var(--anchoran-border)",
  borderRadius: 6,
  padding: "6px 10px",
  color: "var(--anchoran-text-primary)",
  fontSize: 13,
};

export function SettingsApp() {
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("Appearance");
  const prefs = usePreferencesStore();
  const [wallpaperPicker, setWallpaperPicker] = useState(false);
  const [settingsQuery, setSettingsQuery] = useState("");
  const settingsMatches = settingsQuery.trim()
    ? SETTINGS_INDEX.filter((s) => s.label.toLowerCase().includes(settingsQuery.trim().toLowerCase()))
    : [];

  async function onPickWallpaper(result: { path: string } | { dir: string; name: string }) {
    setWallpaperPicker(false);
    if (!("path" in result) || !window.anchoran) return;
    const image = await window.anchoran.fsReadImageFile(result.path);
    if ("dataUrl" in image) prefs.setCustomWallpaper(image.dataUrl);
  }

  return (
    <div className="settings-root">
      <nav className="settings-nav">
        <div style={{ position: "relative", margin: "0 0 8px" }}>
          <input
            placeholder="Find a setting…"
            value={settingsQuery}
            onChange={(e) => setSettingsQuery(e.target.value)}
            style={{ ...inputStyle, width: "100%" }}
          />
          {settingsMatches.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 10,
                background: "var(--anchoran-surface)",
                border: "1px solid var(--anchoran-border)",
                borderRadius: 8,
                marginTop: 4,
                boxShadow: "var(--anchoran-shadow-window)",
                overflow: "hidden",
              }}
            >
              {settingsMatches.map((m) => (
                <button
                  key={m.label}
                  className="settings-nav-item"
                  style={{ width: "100%", display: "flex", alignItems: "center" }}
                  onClick={() => {
                    setSection(m.section);
                    setSettingsQuery("");
                  }}
                >
                  {m.label}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--anchoran-text-secondary)" }}>{m.section}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {SECTIONS.map((s) => (
          <button
            key={s}
            className="settings-nav-item"
            data-active={section === s}
            onClick={() => setSection(s)}
          >
            {s}
          </button>
        ))}
      </nav>
      <div className="settings-panel">
        {section === "Appearance" && (
          <>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Theme</div>
                <div className="settings-row-desc">Choose Light or Dark mode.</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="app-toolbar-btn"
                  data-op={prefs.themeMode === "light"}
                  onClick={() => prefs.setThemeMode("light")}
                >
                  Light
                </button>
                <button
                  className="app-toolbar-btn"
                  data-op={prefs.themeMode === "dark"}
                  onClick={() => prefs.setThemeMode("dark")}
                >
                  Dark
                </button>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Accent color</div>
                <div className="settings-row-desc">Used across windows, controls and highlights.</div>
              </div>
              <div className="swatch-row">
                {ACCENTS.map((color) => (
                  <button
                    key={color}
                    className="swatch"
                    style={{ background: color }}
                    data-active={prefs.accentColor === color}
                    onClick={() => prefs.setAccentColor(color)}
                    aria-label={`Accent ${color}`}
                  />
                ))}
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Animations</div>
                <div className="settings-row-desc">Enable interface motion and transitions.</div>
              </div>
              <input
                type="checkbox"
                checked={prefs.animationsEnabled}
                onChange={(e) => prefs.setAnimationsEnabled(e.target.checked)}
              />
            </div>
          </>
        )}

        {section === "Personalization" && (
          <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
            <div className="settings-row-label">Wallpaper</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {WALLPAPERS.map((wp) => (
                <button
                  key={wp.id}
                  onClick={() => prefs.setWallpaper(wp.id)}
                  style={{
                    width: 110,
                    height: 66,
                    borderRadius: 8,
                    border:
                      prefs.wallpaperId === wp.id
                        ? "2px solid var(--anchoran-accent)"
                        : "1px solid var(--anchoran-border)",
                    background: wp.preview,
                    cursor: "pointer",
                  }}
                  aria-label={wp.name}
                />
              ))}
              {prefs.customWallpaperDataUrl && (
                <button
                  onClick={() => prefs.setWallpaper("custom")}
                  style={{
                    width: 110,
                    height: 66,
                    borderRadius: 8,
                    border:
                      prefs.wallpaperId === "custom"
                        ? "2px solid var(--anchoran-accent)"
                        : "1px solid var(--anchoran-border)",
                    backgroundImage: `url(${prefs.customWallpaperDataUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    cursor: "pointer",
                  }}
                  aria-label="Imported wallpaper"
                />
              )}
            </div>
            <button className="app-toolbar-btn" onClick={() => setWallpaperPicker(true)}>
              Import…
            </button>
          </div>
        )}

        {section === "Display" && (
          <>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Interface scale</div>
                <div className="settings-row-desc">Adjust the size of text and elements.</div>
              </div>
              <input
                type="range"
                min={0.85}
                max={1.25}
                step={0.05}
                value={prefs.uiScale}
                onChange={(e) => prefs.setUiScale(Number(e.target.value))}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Brightness</div>
                <div className="settings-row-desc">Dims the whole display, like a laptop's brightness keys.</div>
              </div>
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.05}
                value={prefs.brightness}
                onChange={(e) => prefs.setBrightness(Number(e.target.value))}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Night Light</div>
                <div className="settings-row-desc">Warms the display's colors to ease eye strain in the evening.</div>
              </div>
              <input
                type="checkbox"
                checked={prefs.nightLightEnabled}
                onChange={(e) => prefs.setNightLightEnabled(e.target.checked)}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">High contrast</div>
                <div className="settings-row-desc">Stronger borders and higher-contrast text throughout Anchoran.</div>
              </div>
              <input
                type="checkbox"
                checked={prefs.highContrast}
                onChange={(e) => prefs.setHighContrast(e.target.checked)}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Large text</div>
                <div className="settings-row-desc">Scales up text and UI elements beyond the interface scale above.</div>
              </div>
              <input
                type="checkbox"
                checked={prefs.largeText}
                onChange={(e) => prefs.setLargeText(e.target.checked)}
              />
            </div>
            <DisplaySection />
          </>
        )}

        {section === "Sound" && (
          <>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">System sounds</div>
                <div className="settings-row-desc">Login, notification and error tones.</div>
              </div>
              <input
                type="checkbox"
                checked={prefs.soundEnabled}
                onChange={(e) => prefs.setSoundEnabled(e.target.checked)}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Volume</div>
                <div className="settings-row-desc">Applies to Anchoran's own system sounds.</div>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={prefs.soundVolume}
                disabled={!prefs.soundEnabled}
                onChange={(e) => prefs.setSoundVolume(Number(e.target.value))}
                onMouseUp={() => playNotificationSound()}
              />
            </div>
          </>
        )}

        {section === "Network" && <NetworkSection />}

        {section === "Notifications" && <NotificationsSection />}

        {section === "Users" && <UsersSection />}

        {section === "Privacy" && <PrivacySection />}

        {section === "System" && <SystemSection />}

        {section === "Shortcuts" && <ShortcutsSection />}

        {section === "System Mode" && <SystemModeSection />}

        {section === "Updater" && <AboutSection />}
      </div>
      {wallpaperPicker && (
        <AnchoranFilePicker
          mode="open"
          title="Import a wallpaper"
          extensions={IMAGE_EXTENSIONS}
          onConfirm={onPickWallpaper}
          onCancel={() => setWallpaperPicker(false)}
        />
      )}
    </div>
  );
}

/**
 * Multi-monitor, phase 1: Anchoran is still one fullscreen window (see
 * electron/main.ts), but it can be moved to occupy a different
 * connected display. Only rendered when the Electron bridge exposes
 * display info — e.g. not in a plain-browser preview of the renderer.
 */
function DisplaySection() {
  const [displays, setDisplays] = useState<{ id: number; label: string; isPrimary: boolean }[]>([]);

  useEffect(() => {
    window.anchoran?.getDisplays().then(setDisplays);
  }, []);

  if (displays.length <= 1) return null;

  return (
    <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
      <div>
        <div className="settings-row-label">Displays</div>
        <div className="settings-row-desc">Move Anchoran to a different connected monitor.</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {displays.map((d) => (
          <button key={d.id} className="app-toolbar-btn" onClick={() => window.anchoran?.moveToDisplay(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NetworkSection() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="settings-row">
      <div>
        <div className="settings-row-label">Connectivity</div>
        <div className="settings-row-desc">
          Anchoran reads connectivity from Windows; it doesn't manage Wi-Fi/network
          configuration itself.
        </div>
      </div>
      <span style={{ fontSize: 13, color: online ? "var(--anchoran-accent)" : "var(--anchoran-text-secondary)" }}>
        {online ? "Online" : "Offline"}
      </span>
    </div>
  );
}

function NotificationsSection() {
  const doNotDisturb = useNotificationStore((s) => s.doNotDisturb);
  const setDoNotDisturb = useNotificationStore((s) => s.setDoNotDisturb);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const count = useNotificationStore((s) => s.notifications.length);

  return (
    <>
      <div className="settings-row">
        <div>
          <div className="settings-row-label">Do Not Disturb</div>
          <div className="settings-row-desc">Silence toasts and sounds; notifications still log to history.</div>
        </div>
        <input type="checkbox" checked={doNotDisturb} onChange={(e) => setDoNotDisturb(e.target.checked)} />
      </div>
      <div className="settings-row">
        <div>
          <div className="settings-row-label">History</div>
          <div className="settings-row-desc">{count} notification{count === 1 ? "" : "s"} stored.</div>
        </div>
        <button className="app-toolbar-btn" onClick={clearAll} disabled={count === 0}>
          Clear all
        </button>
      </div>
    </>
  );
}

function UsersSection() {
  const prefs = usePreferencesStore();
  const [pinDraft, setPinDraft] = useState("");
  const profiles = useProfilesStore((s) => s.profiles);
  const activeProfileId = useProfilesStore((s) => s.activeProfileId);
  const createProfile = useProfilesStore((s) => s.createProfile);
  const deleteProfile = useProfilesStore((s) => s.deleteProfile);
  const switchProfile = useProfilesStore((s) => s.switchProfile);
  const [newProfileName, setNewProfileName] = useState("");
  const [avatarPicker, setAvatarPicker] = useState(false);

  async function onPickAvatar(result: { path: string } | { dir: string; name: string }) {
    setAvatarPicker(false);
    if (!("path" in result) || !window.anchoran) return;
    const image = await window.anchoran.fsReadImageFile(result.path);
    if ("dataUrl" in image) prefs.setAvatar(image.dataUrl);
  }

  return (
    <>
      <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div className="settings-row-label">Profiles</div>
          <div className="settings-row-desc">
            Each profile has its own name, avatar, PIN and appearance (accent color, wallpaper, theme). App data —
            Notes, Files, and every other app — is shared across profiles.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, width: "100%" }}>
          {profiles.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: "var(--anchoran-radius-md)",
                border: p.id === activeProfileId ? "1px solid var(--anchoran-accent)" : "1px solid var(--anchoran-border)",
                background: p.id === activeProfileId ? "var(--anchoran-accent-soft)" : "transparent",
              }}
            >
              <span style={{ fontSize: 12.5 }}>{p.name}</span>
              {p.id === activeProfileId ? (
                <span style={{ fontSize: 10.5, color: "var(--anchoran-accent)" }}>Active</span>
              ) : (
                <button className="app-toolbar-btn" onClick={() => switchProfile(p.id)}>
                  Switch to
                </button>
              )}
              {profiles.length > 1 && (
                <button
                  className="app-toolbar-btn"
                  onClick={() => {
                    if (window.confirm(`Delete profile "${p.name}"? This can't be undone.`)) deleteProfile(p.id);
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="New profile name"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            style={inputStyle}
          />
          <button
            className="app-toolbar-btn"
            disabled={!newProfileName.trim()}
            onClick={() => {
              createProfile(newProfileName.trim());
              setNewProfileName("");
            }}
          >
            Add profile
          </button>
        </div>
      </div>
      <div className="settings-row">
        <div>
          <div className="settings-row-label">Profile picture</div>
          <div className="settings-row-desc">Shown on the lock screen.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: `url(${prefs.avatarDataUrl || DEFAULT_AVATAR}) center/cover`,
            }}
          />
          <button className="app-toolbar-btn" onClick={() => setAvatarPicker(true)}>
            Import…
          </button>
          {prefs.avatarDataUrl && (
            <button className="app-toolbar-btn" onClick={() => prefs.setAvatar(null)}>
              Remove
            </button>
          )}
          {avatarPicker && (
            <AnchoranFilePicker
              mode="open"
              title="Import a profile picture"
              extensions={IMAGE_EXTENSIONS}
              onConfirm={onPickAvatar}
              onCancel={() => setAvatarPicker(false)}
            />
          )}
        </div>
      </div>
      <div className="settings-row">
        <div className="settings-row-label">Username</div>
        <input
          value={prefs.username}
          onChange={(e) => prefs.setUsername(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div className="settings-row">
        <div>
          <div className="settings-row-label">Lock screen PIN</div>
          <div className="settings-row-desc">
            {prefs.lockPin ? "A PIN is required to unlock Anchoran." : "No PIN set — Anchoran unlocks on any input."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!prefs.lockPin ? (
            <>
              <input
                type="password"
                inputMode="numeric"
                placeholder="4+ digits"
                value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 8))}
                style={{ ...inputStyle, width: 90 }}
              />
              <button
                className="app-toolbar-btn"
                disabled={pinDraft.length < 4}
                onClick={() => {
                  prefs.setLockPin(pinDraft);
                  setPinDraft("");
                }}
              >
                Set PIN
              </button>
            </>
          ) : (
            <button className="app-toolbar-btn" onClick={() => prefs.setLockPin(null)}>
              Remove PIN
            </button>
          )}
        </div>
      </div>
      {prefs.lockPin && (
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Auto-lock</div>
            <div className="settings-row-desc">Lock Anchoran automatically after a period of inactivity.</div>
          </div>
          <select
            value={prefs.autoLockMinutes}
            onChange={(e) => prefs.setAutoLockMinutes(Number(e.target.value))}
            style={inputStyle}
          >
            <option value={0}>Never</option>
            <option value={1}>1 minute</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
          </select>
        </div>
      )}
    </>
  );
}

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Ctrl + Alt + L", action: "Open the Launcher (also works if the Windows key can't be captured)" },
  { keys: "Ctrl + Tab", action: "Switch to the next open window" },
  { keys: "Ctrl + Shift + Tab", action: "Switch to the previous open window" },
  { keys: "Space", action: "Quick Look a selected file in Files — a read-only preview, without opening it" },
  { keys: "Ctrl + Z", action: "Undo the last action in Files" },
  { keys: "Ctrl + Y", action: "Redo in Files" },
  { keys: "Ctrl + X / C / V", action: "Cut / Copy / Paste selected items in Files" },
  { keys: "Delete", action: "Delete the selected item(s) in Files (or delete permanently, in Trash)" },
  { keys: "Ctrl / Cmd + Click", action: "Multi-select items in Files" },
  { keys: "Drag to a screen edge", action: "Snap a window to a half or, near a corner, a quarter of the screen" },
  { keys: "Double-click a title bar", action: "Maximize or restore a window" },
  { keys: "Right-click the desktop", action: "New Folder, New File, Sort Icons, Change Wallpaper" },
  { keys: "Right-click a taskbar icon", action: "Pin or unpin an app" },
  { keys: "Escape", action: "Close an open menu or panel" },
];

function ShortcutsSection() {
  return (
    <>
      <p style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5, marginTop: 0 }}>
        Every keyboard and mouse shortcut Anchoran responds to.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {SHORTCUTS.map((s) => (
          <div
            key={s.keys}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "9px 0",
              borderBottom: "1px solid var(--anchoran-border)",
            }}
          >
            <span
              style={{
                fontFamily: "Cascadia Code, Consolas, monospace",
                fontSize: 12,
                padding: "3px 8px",
                borderRadius: 6,
                background: "var(--anchoran-bg)",
                border: "1px solid var(--anchoran-border)",
                whiteSpace: "nowrap",
                flexShrink: 0,
                width: 190,
              }}
            >
              {s.keys}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--anchoran-text-secondary)" }}>{s.action}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function SystemModeSection() {
  const running = useSystemModeStore((s) => s.running);
  const starting = useSystemModeStore((s) => s.starting);
  const error = useSystemModeStore((s) => s.error);
  const start = useSystemModeStore((s) => s.start);
  const stop = useSystemModeStore((s) => s.stop);
  const refreshStatus = useSystemModeStore((s) => s.refreshStatus);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>System Mode</h3>
        {running && (
          <span
            style={{
              fontSize: 10.5,
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--anchoran-accent-soft)",
              color: "var(--anchoran-accent)",
            }}
          >
            Active
          </span>
        )}
      </div>
      <p style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5, marginTop: 0, maxWidth: 520 }}>
        While System Mode is on, Anchoran claims the Windows key (opens
        the Launcher instead of the Start Menu) and Alt+Tab (opens
        Anchoran's own window switcher instead of Windows') — everything
        else, including Windows itself and whatever you had open before
        starting Anchoran, keeps running untouched underneath. Turning
        it off, closing Anchoran, or restarting your PC all immediately
        return every key to normal Windows behavior. Ctrl+Alt+Delete is
        never affected — Windows itself guarantees that, no matter what.
      </p>
      <div className="settings-row">
        <div>
          <div className="settings-row-label">Claim Windows key &amp; Alt+Tab</div>
          <div className="settings-row-desc">
            {starting
              ? "Starting…"
              : running
                ? "Active for this session — turns off automatically when Anchoran closes."
                : "Off. Starts fresh every time you launch Anchoran."}
          </div>
        </div>
        <button className="app-toolbar-btn" disabled={starting} onClick={() => (running ? stop() : start())}>
          {running ? "Turn off" : "Turn on"}
        </button>
      </div>
      {error && (
        <p style={{ color: "#E5484D", fontSize: 12, marginTop: 8 }}>{error}</p>
      )}
    </>
  );
}

function PrivacySection() {
  const [status, setStatus] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  async function onExport() {
    const result = await window.anchoran?.exportData();
    setStatus(result?.success ? `Exported to ${result.path}` : null);
  }

  async function onImport() {
    const result = await window.anchoran?.importData();
    if (result?.success) {
      setStatus("Imported. Restarting Anchoran to apply…");
      setTimeout(() => window.anchoran?.restart(), 1200);
    } else if (result?.error) {
      setStatus(result.error);
    }
  }

  async function onReset() {
    await window.anchoran?.resetData();
    setStatus("Reset. Restarting Anchoran…");
    setTimeout(() => window.anchoran?.restart(), 1000);
  }

  return (
    <>
      <p style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>
        Anchoran's data stays local to its own filesystem and never touches host Windows
        files.
      </p>
      <div className="settings-row">
        <div>
          <div className="settings-row-label">Backup</div>
          <div className="settings-row-desc">Export or import your preferences and virtual filesystem.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="app-toolbar-btn" onClick={onExport}>Export…</button>
          <button className="app-toolbar-btn" onClick={onImport}>Import…</button>
        </div>
      </div>
      <div className="settings-row">
        <div>
          <div className="settings-row-label">Reset Anchoran</div>
          <div className="settings-row-desc">Erases all preferences and files. Cannot be undone.</div>
        </div>
        {!confirmingReset ? (
          <button className="app-toolbar-btn" onClick={() => setConfirmingReset(true)}>
            Reset…
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="app-toolbar-btn" onClick={() => setConfirmingReset(false)}>Cancel</button>
            <button className="app-toolbar-btn" style={{ color: "#D64545" }} onClick={onReset}>
              Confirm reset
            </button>
          </div>
        )}
      </div>
      {status && <p style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>{status}</p>}
    </>
  );
}

function SystemSection() {
  const [info, setInfo] = useState<Awaited<ReturnType<NonNullable<typeof window.anchoran>["getSystemInfo"]>> | null>(
    null
  );
  const defaultApps = useDefaultAppsStore();

  useEffect(() => {
    window.anchoran?.getSystemInfo().then(setInfo);
  }, []);

  return (
    <>
      <p style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>
        Anchoran OS {ANCHORAN_VERSION} — running as a shell application on top of Windows.
      </p>
      {info && (
        <>
          <div className="settings-row">
            <div className="settings-row-label">Processor</div>
            <span style={{ fontSize: 12.5, color: "var(--anchoran-text-secondary)" }}>{info.cpuModel}</span>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">Memory</div>
            <span style={{ fontSize: 12.5, color: "var(--anchoran-text-secondary)" }}>{info.totalMemMB} MB</span>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">Platform</div>
            <span style={{ fontSize: 12.5, color: "var(--anchoran-text-secondary)" }}>{info.platform}</span>
          </div>
        </>
      )}

      <div className="settings-row">
        <div>
          <div className="settings-row-label">Default apps</div>
          <div className="settings-row-desc">Which app Files opens each file type with by default.</div>
        </div>
      </div>
      {(
        [
          { key: "images", label: "Images", appLabel: "Photo Viewer" },
          { key: "text", label: "Text files", appLabel: "Notes" },
          { key: "audioVideo", label: "Audio & video", appLabel: "Media Player" },
          { key: "zip", label: "Zip archives", appLabel: "Quick Look" },
        ] as const
      ).map((row) => (
        <div className="settings-row" key={row.key}>
          <div className="settings-row-label">{row.label}</div>
          <select
            value={defaultApps[row.key]}
            onChange={(e) => defaultApps.setDefault(row.key, e.target.value as never)}
            style={inputStyle}
          >
            <option value={row.key === "zip" ? "quickLook" : row.key === "images" ? "photoViewer" : row.key === "text" ? "notes" : "mediaPlayer"}>
              {row.appLabel} (Anchoran)
            </option>
            <option value="external">Windows default app</option>
          </select>
        </div>
      ))}
    </>
  );
}

function AboutSection() {
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [downloadedVersion, setDownloadedVersion] = useState<string | null>(null);

  useEffect(() => {
    window.anchoran?.onUpdateStatus((status) => {
      if (status.state === "checking") setUpdateStatus("Checking for updates…");
      else if (status.state === "available") setUpdateStatus(`Update available: v${status.version}. Downloading…`);
      else if (status.state === "not-available") setUpdateStatus("Anchoran OS is up to date.");
      else if (status.state === "downloading") setUpdateStatus(`Downloading… ${status.percent}%`);
      else if (status.state === "downloaded") {
        setUpdateStatus(`Update v${status.version} ready to install.`);
        setDownloadedVersion(status.version);
      } else if (status.state === "error") setUpdateStatus(`Couldn't check for updates: ${status.message}`);
    });
  }, []);

  return (
    <div>
      <AnchoranLogo size={40} color="var(--anchoran-accent)" style={{ marginBottom: 10 }} />
      <h2 style={{ margin: "0 0 4px", fontWeight: 500 }}>Anchoran OS</h2>
      <p style={{ color: "var(--anchoran-text-secondary)", marginTop: 0 }}>Version {ANCHORAN_VERSION}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="app-toolbar-btn"
          onClick={() => {
            if (!window.anchoran) {
              setUpdateStatus("Not available outside the Anchoran desktop app.");
              return;
            }
            setUpdateStatus("Checking…");
            window.anchoran.checkForUpdates();
          }}
        >
          Check for updates
        </button>
        {downloadedVersion && (
          <button className="app-toolbar-btn" onClick={() => window.anchoran?.quitAndInstallUpdate()}>
            Restart & install v{downloadedVersion}
          </button>
        )}
      </div>
      {updateStatus && (
        <p style={{ fontSize: 12, color: "var(--anchoran-text-secondary)", marginTop: 8 }}>{updateStatus}</p>
      )}
      <UpdateHistoryList />
    </div>
  );
}

function UpdateHistoryList() {
  const history = useUpdateHistoryStore((s) => s.history);

  if (history.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 8 }}>Update history</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {history.map((entry, i) => (
          <div key={i} style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>
            {entry.fromVersion} → {entry.toVersion} · {new Date(entry.installedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
          </div>
        ))}
      </div>
    </div>
  );
}
