import { useEffect, useState, type CSSProperties } from "react";
import { usePreferencesStore, DEFAULT_PREFERENCES } from "@/theme/preferencesStore";
import { useNotificationStore } from "@/notifications/notificationStore";
import { ANCHORAN_VERSION } from "@/core/version";
import { WALLPAPERS, getWallpaper } from "@/desktop/wallpapers";
import { playNotificationSound } from "@/core/sound";
import { useUpdateHistoryStore } from "@/core/updateHistory";
import { useSystemModeStore } from "@/desktop/systemModeStore";
import { useProfilesStore } from "@/core/profilesStore";
import { usePinAttemptsStore } from "@/core/pinAttemptsStore";
import { useAdminAuditStore } from "@/core/adminAuditStore";
import { useSettingsChangeLogStore } from "@/theme/settingsChangeLogStore";
import { useWallpaperSpotlightStore } from "@/theme/wallpaperSpotlightStore";
import { useShortcutPrefsStore, MODIFIER_LABELS, type ModifierCombo } from "@/core/shortcutPrefsStore";
import { renderMarkdown } from "@/core/markdown";
import { useAnchoranStartupAppsStore } from "@/core/anchoranStartupAppsStore";
import { useInstalledAppsStore } from "@/applications/installedAppsStore";
import { APP_LIST, APP_REGISTRY } from "@/applications/registry";
import type { AppId } from "@/core/types";
import { AdminPinPrompt } from "@/core/AdminPinPrompt";
import { AnchoranLogo } from "@/components/AnchoranLogo";
import { AnchoranFilePicker } from "@/core/AnchoranFilePicker";
import { useDefaultAppsStore } from "@/core/defaultAppsStore";
import { useClipboardHistoryStore } from "@/core/clipboardHistoryStore";
import { useNotificationSoundStore } from "@/notifications/notificationSoundStore";
import type { NotificationSoundVariant } from "@/core/sound";
import "@/applications/apps.css";
import "@/applications/notes/notes.css";

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

// Full theme presets — one click sets theme mode, accent color and
// wallpaper together, instead of tuning the three separately every
// time you want a whole different look.
const THEME_PRESETS: { name: string; themeMode: "light" | "dark"; accentColor: string; wallpaperId: string }[] = [
  { name: "Anchoran Deep", themeMode: "dark", accentColor: "#6E9BF7", wallpaperId: "default" },
  { name: "Slate", themeMode: "dark", accentColor: "#94A3B8", wallpaperId: "slate" },
  { name: "Dawn", themeMode: "light", accentColor: "#B45309", wallpaperId: "dawn" },
  { name: "Mist", themeMode: "light", accentColor: "#1E3A8A", wallpaperId: "mist" },
  { name: "Ember", themeMode: "dark", accentColor: "#B45309", wallpaperId: "ember" },
  { name: "Verdant", themeMode: "dark", accentColor: "#0F766E", wallpaperId: "verdant" },
];

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

/** Wraps the part of `text` matching `query` in a `<mark>`, case-insensitively — used by the "Find a setting…" search results. */
function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "var(--anchoran-accent-soft)", color: "var(--anchoran-accent)", borderRadius: 3 }}>
        {text.slice(idx, idx + query.trim().length)}
      </mark>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

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
  // The Guest profile can't personalize its desktop at all — its appearance
  // resets to fixed defaults every time it's entered anyway, so letting it
  // change accent/wallpaper/theme here would just be a change that's thrown
  // away the moment someone locks and re-enters Guest.
  const isGuestActive = useProfilesStore((s) => s.profiles.find((p) => p.id === s.activeProfileId)?.isGuest ?? false);
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
                  {highlightMatch(m.label, settingsQuery)}
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
          <fieldset disabled={isGuestActive} style={{ border: "none", margin: 0, padding: 0, display: "contents" }}>
            {isGuestActive && <GuestLockedBanner />}
            <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div className="settings-row-label">Theme presets</div>
                <div className="settings-row-desc">Theme mode, accent and wallpaper together, in one click.</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      prefs.setThemeMode(preset.themeMode);
                      prefs.setAccentColor(preset.accentColor);
                      prefs.setWallpaper(preset.wallpaperId);
                    }}
                    title={preset.name}
                    style={{
                      width: 72,
                      height: 48,
                      borderRadius: 8,
                      border:
                        prefs.themeMode === preset.themeMode &&
                        prefs.accentColor === preset.accentColor &&
                        prefs.wallpaperId === preset.wallpaperId
                          ? "2px solid var(--anchoran-accent)"
                          : "1px solid var(--anchoran-border)",
                      background: getWallpaper(preset.wallpaperId).preview,
                      position: "relative",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        bottom: 4,
                        right: 4,
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: preset.accentColor,
                        boxShadow: "0 0 0 1.5px rgba(0,0,0,0.4)",
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
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
            <ResetSectionButton
              onReset={() => {
                prefs.setThemeMode(DEFAULT_PREFERENCES.themeMode);
                prefs.setAccentColor(DEFAULT_PREFERENCES.accentColor);
                prefs.setAnimationsEnabled(DEFAULT_PREFERENCES.animationsEnabled);
              }}
            />
          </fieldset>
        )}

        {section === "Personalization" && (
          <fieldset disabled={isGuestActive} style={{ border: "none", margin: 0, padding: 0, display: "contents" }}>
            {isGuestActive && <GuestLockedBanner />}
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
            <WallpaperSpotlightRow />
            <ResetSectionButton
              onReset={() => {
                prefs.setWallpaper(DEFAULT_PREFERENCES.wallpaperId);
              }}
            />
          </div>
          </fieldset>
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
            <ResetSectionButton
              onReset={() => {
                prefs.setUiScale(DEFAULT_PREFERENCES.uiScale);
                prefs.setBrightness(DEFAULT_PREFERENCES.brightness);
                prefs.setNightLightEnabled(DEFAULT_PREFERENCES.nightLightEnabled);
                prefs.setHighContrast(DEFAULT_PREFERENCES.highContrast);
                prefs.setLargeText(DEFAULT_PREFERENCES.largeText);
              }}
            />
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
            <ResetSectionButton
              onReset={() => {
                prefs.setSoundEnabled(DEFAULT_PREFERENCES.soundEnabled);
                prefs.setSoundVolume(DEFAULT_PREFERENCES.soundVolume);
              }}
            />
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
/** Shown above a settings section that's disabled because the active profile is the permanent Guest, which can't personalize anything — its appearance resets to fixed defaults every time it's entered anyway. */
function GuestLockedBanner() {
  return (
    <div
      className="settings-row"
      style={{
        borderBottom: "none",
        background: "var(--anchoran-accent-soft)",
        borderRadius: "var(--anchoran-radius-md)",
        padding: "8px 12px",
        marginBottom: 4,
      }}
    >
      <div className="settings-row-desc" style={{ color: "var(--anchoran-text-primary)" }}>
        The Guest profile can't be personalized — it always resets to its defaults the next time you sign into it.
      </div>
    </div>
  );
}

/** A per-section "restore factory defaults" — narrower than Privacy's whole-app Reset, and without needing a confirmation step since it only ever touches a handful of easily-reversible appearance/behavior settings, never files or the PIN. */
function ResetSectionButton({ onReset }: { onReset: () => void }) {
  return (
    <div className="settings-row" style={{ borderBottom: "none" }}>
      <div />
      <button className="app-toolbar-btn" onClick={onReset}>
        Restore defaults for this section
      </button>
    </div>
  );
}

/** A plain, everyday log of recent preference changes — see settingsChangeLogStore.ts. */
function RecentChangesRow() {
  const entries = useSettingsChangeLogStore((s) => s.entries);
  const clear = useSettingsChangeLogStore((s) => s.clear);
  return (
    <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="settings-row-label">Recent changes</div>
          <div className="settings-row-desc">What you've changed here recently.</div>
        </div>
        {entries.length > 0 && (
          <button className="app-toolbar-btn" onClick={clear}>
            Clear
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>No changes recorded yet.</div>
      ) : (
        <div style={{ maxHeight: 140, overflowY: "auto", width: "100%", fontSize: 12, color: "var(--anchoran-text-secondary)" }}>
          {entries.map((e) => (
            <div key={e.id}>{new Date(e.timestamp).toLocaleString()} — {e.description}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Spotlight-style self-rotating wallpaper — see wallpaperSpotlightStore.ts. */
function WallpaperSpotlightRow() {
  const enabled = useWallpaperSpotlightStore((s) => s.enabled);
  const setEnabled = useWallpaperSpotlightStore((s) => s.setEnabled);
  const rotateNow = useWallpaperSpotlightStore((s) => s.rotateNow);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Change wallpaper automatically every day
      </label>
      {enabled && (
        <button className="app-toolbar-btn" onClick={rotateNow}>
          Shuffle now
        </button>
      )}
    </div>
  );
}

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

const SOUND_VARIANT_LABELS: Record<NotificationSoundVariant, string> = {
  default: "Default",
  chime: "Chime",
  pop: "Pop",
  none: "Silent",
};

function NotificationsSection() {
  const doNotDisturb = useNotificationStore((s) => s.doNotDisturb);
  const setDoNotDisturb = useNotificationStore((s) => s.setDoNotDisturb);
  const dndSchedule = useNotificationStore((s) => s.dndSchedule);
  const setDndSchedule = useNotificationStore((s) => s.setDndSchedule);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const notifications = useNotificationStore((s) => s.notifications);
  const count = notifications.length;
  const byApp = useNotificationSoundStore((s) => s.byApp);
  const setSound = useNotificationSoundStore((s) => s.setSound);
  // Only apps that have actually pushed a notification — a fixed list
  // of every app that *could* is mostly dead rows, since most never
  // will.
  const knownApps = Array.from(new Set(notifications.map((n) => n.title))).sort();
  const [historyExportPicker, setHistoryExportPicker] = useState(false);

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
          <div className="settings-row-label">Scheduled Do Not Disturb</div>
          <div className="settings-row-desc">
            Automatically turns on and off at set times each day{dndSchedule.enabled ? ` — ${dndSchedule.start} to ${dndSchedule.end}` : ""}.
          </div>
        </div>
        <input
          type="checkbox"
          checked={dndSchedule.enabled}
          onChange={(e) => setDndSchedule({ enabled: e.target.checked })}
        />
      </div>
      {dndSchedule.enabled && (
        <div className="settings-row">
          <div className="settings-row-label">Quiet hours</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="time"
              value={dndSchedule.start}
              onChange={(e) => setDndSchedule({ start: e.target.value })}
              style={inputStyle}
            />
            <span style={{ color: "var(--anchoran-text-secondary)" }}>to</span>
            <input
              type="time"
              value={dndSchedule.end}
              onChange={(e) => setDndSchedule({ end: e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>
      )}
      <div className="settings-row">
        <div>
          <div className="settings-row-label">History</div>
          <div className="settings-row-desc">{count} notification{count === 1 ? "" : "s"} stored.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="app-toolbar-btn" onClick={() => setHistoryExportPicker(true)} disabled={count === 0}>
            Export…
          </button>
          <button className="app-toolbar-btn" onClick={clearAll} disabled={count === 0}>
            Clear all
          </button>
        </div>
      </div>
      {historyExportPicker && (
        <AnchoranFilePicker
          mode="save"
          title="Export notification history"
          defaultName="anchoran-notifications.txt"
          onConfirm={async (result) => {
            setHistoryExportPicker(false);
            if (!("dir" in result) || !window.anchoran) return;
            const report = notifications
              .slice()
              .reverse()
              .map((n) => `${new Date(n.createdAt).toLocaleString()}  [${n.title}]  ${n.message}`)
              .join("\n");
            const name = /\.[^.\\/]+$/.test(result.name) ? result.name : `${result.name}.txt`;
            await window.anchoran.fsWriteTextFile(`${result.dir}\\${name}`, report);
          }}
          onCancel={() => setHistoryExportPicker(false)}
        />
      )}
      {knownApps.length > 0 && (
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
          <div>
            <div className="settings-row-label">Sounds per app</div>
            <div className="settings-row-desc">A different tone (or silence) per app that's notified you.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
            {knownApps.map((app) => (
              <div key={app} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, fontSize: 12.5 }}>{app}</span>
                <select
                  value={byApp[app] ?? "default"}
                  onChange={(e) => setSound(app, e.target.value as NotificationSoundVariant)}
                  style={inputStyle}
                >
                  {(Object.keys(SOUND_VARIANT_LABELS) as NotificationSoundVariant[]).map((v) => (
                    <option key={v} value={v}>
                      {SOUND_VARIANT_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const setProfileAdmin = useProfilesStore((s) => s.setProfileAdmin);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileAdmin, setNewProfileAdmin] = useState(false);
  const [avatarPicker, setAvatarPicker] = useState(false);
  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const isOwner = !!activeProfile?.isOwner;
  const isGuestActive = !!activeProfile?.isGuest;

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
            Notes, Files, and every other app — is shared across profiles. You can only edit your own profile's
            details below; only this PC's owner admin can grant or revoke admin status on other profiles. Switching
            to a different profile is only done from the lock screen, not from here.
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
              {p.isOwner ? (
                <span style={{ fontSize: 10.5, color: "var(--anchoran-accent)" }}>Owner</span>
              ) : p.isGuest ? (
                <span style={{ fontSize: 10.5, color: "var(--anchoran-text-secondary)" }}>Guest</span>
              ) : p.isAdmin ? (
                <span style={{ fontSize: 10.5, color: "var(--anchoran-text-secondary)" }}>Admin</span>
              ) : null}
              {p.id === activeProfileId && (
                <span style={{ fontSize: 10.5, color: "var(--anchoran-accent)" }}>Active</span>
              )}
              {isOwner && !p.isOwner && !p.isGuest && (
                <button className="app-toolbar-btn" onClick={() => setProfileAdmin(p.id, !p.isAdmin)}>
                  {p.isAdmin ? "Revoke admin" : "Make admin"}
                </button>
              )}
              {profiles.length > 1 && !p.isOwner && !p.isGuest && (
                <button
                  className="app-toolbar-btn"
                  onClick={() => {
                    if (p.id === activeProfileId) {
                      // Deleting the profile you're actually signed in as
                      // right now needs a real, fullscreen, deliberate
                      // stop — not a window.confirm() — since it can't
                      // just fall through to switching you into another
                      // profile silently. Handled at the App.tsx root
                      // (same as the update-ready screen) so it's a true
                      // full-desktop takeover, not just confined to this
                      // Settings window. See DeleteOwnProfileConfirm.tsx.
                      window.dispatchEvent(new CustomEvent("anchoran-request-delete-own-profile", { detail: p.id }));
                    } else if (window.confirm(`Delete profile "${p.name}"? This can't be undone.`)) {
                      deleteProfile(p.id);
                    }
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            placeholder="New profile name"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            style={inputStyle}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={newProfileAdmin}
              onChange={(e) => setNewProfileAdmin(e.target.checked)}
            />
            Administrator
          </label>
          <button
            className="app-toolbar-btn"
            disabled={!newProfileName.trim()}
            onClick={() => {
              createProfile(newProfileName.trim(), newProfileAdmin);
              setNewProfileName("");
              setNewProfileAdmin(false);
            }}
          >
            Add profile
          </button>
        </div>
      </div>
      <fieldset disabled={isGuestActive} style={{ border: "none", margin: 0, padding: 0, display: "contents" }}>
      {isGuestActive && <GuestLockedBanner />}
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
      </fieldset>
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
      {isOwner && <FailedPinAttemptsRow />}
      {isOwner && <AdminAuditLogRow />}
    </>
  );
}

/** Owner-only: a real audit trail of admin-level actions on this PC — elevations and admin grants/revokes — not just failed attempts. */
function AdminAuditLogRow() {
  const entries = useAdminAuditStore((s) => s.entries);
  const clear = useAdminAuditStore((s) => s.clear);
  return (
    <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="settings-row-label">Admin audit log</div>
          <div className="settings-row-desc">Every elevation and admin status change on this PC.</div>
        </div>
        {entries.length > 0 && (
          <button className="app-toolbar-btn" onClick={clear}>
            Clear
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>No admin actions recorded.</div>
      ) : (
        <div style={{ maxHeight: 140, overflowY: "auto", width: "100%", fontSize: 12, color: "var(--anchoran-text-secondary)" }}>
          {entries.map((e) => (
            <div key={e.id}>{new Date(e.timestamp).toLocaleString()} — {e.action}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Owner-only: a log of failed PIN attempts on the lock screen, so tampering doesn't go unnoticed. */
function FailedPinAttemptsRow() {
  const attempts = usePinAttemptsStore((s) => s.attempts);
  const clear = usePinAttemptsStore((s) => s.clear);
  return (
    <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="settings-row-label">Failed PIN attempts</div>
          <div className="settings-row-desc">Visible only to you, the owner of this PC.</div>
        </div>
        {attempts.length > 0 && (
          <button className="app-toolbar-btn" onClick={clear}>
            Clear
          </button>
        )}
      </div>
      {attempts.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>No failed attempts recorded.</div>
      ) : (
        <div style={{ maxHeight: 120, overflowY: "auto", width: "100%", fontSize: 12, color: "var(--anchoran-text-secondary)" }}>
          {attempts.map((a) => (
            <div key={a.id}>{new Date(a.timestamp).toLocaleString()}</div>
          ))}
        </div>
      )}
    </div>
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
  { keys: "[modifier] + Left / Right", action: "Snap the focused window to a left/right third of the screen — modifier customizable below" },
  { keys: "[modifier] + Down", action: "Snap the focused window to the center third of the screen — modifier customizable below" },
  { keys: "[modifier] + Arrow", action: "Resize the focused window in fixed steps from the keyboard — modifier customizable below" },
  { keys: "Ctrl + Alt + M", action: "Move the whole Anchoran window to the next connected monitor" },
  { keys: "[modifier] + Page Up / Page Down", action: "Switch to the previous/next virtual desktop — modifier customizable below" },
  { keys: "Double-click a title bar", action: "Maximize or restore a window" },
  { keys: "Right-click the desktop", action: "New Folder, New File, Sort Icons, Change Wallpaper" },
  { keys: "Right-click a taskbar icon", action: "Pin or unpin an app" },
  { keys: "Escape", action: "Close an open menu or panel" },
];

function ShortcutsSection() {
  const desktopModifier = useShortcutPrefsStore((s) => s.desktopModifier);
  const setDesktopModifier = useShortcutPrefsStore((s) => s.setDesktopModifier);
  const resizeModifier = useShortcutPrefsStore((s) => s.resizeModifier);
  const setResizeModifier = useShortcutPrefsStore((s) => s.setResizeModifier);

  return (
    <>
      <p style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5, marginTop: 0 }}>
        Every keyboard and mouse shortcut Anchoran responds to. The two below can use a
        different modifier combo if the defaults clash with something else on your system —
        the rest (drag/click gestures, and the global Launcher/screenshot shortcuts Electron
        registers at the OS level) stay fixed for now.
      </p>
      <div className="settings-row">
        <div>
          <div className="settings-row-label">Snap-to-third / switch desktop modifier</div>
          <div className="settings-row-desc">Arrow keys snap thirds, Page Up/Down switch virtual desktops.</div>
        </div>
        <select
          className="app-toolbar-btn"
          value={desktopModifier}
          onChange={(e) => setDesktopModifier(e.target.value as ModifierCombo)}
        >
          {(Object.keys(MODIFIER_LABELS) as ModifierCombo[]).map((m) => (
            <option key={m} value={m}>
              {MODIFIER_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <div className="settings-row">
        <div>
          <div className="settings-row-label">Keyboard resize modifier</div>
          <div className="settings-row-desc">Arrow keys resize the focused window in steps.</div>
        </div>
        <select
          className="app-toolbar-btn"
          value={resizeModifier}
          onChange={(e) => setResizeModifier(e.target.value as ModifierCombo)}
        >
          {(Object.keys(MODIFIER_LABELS) as ModifierCombo[]).map((m) => (
            <option key={m} value={m}>
              {MODIFIER_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
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
  const [resetPinPrompt, setResetPinPrompt] = useState(false);
  const retentionMinutes = useClipboardHistoryStore((s) => s.retentionMinutes);
  const setRetentionMinutes = useClipboardHistoryStore((s) => s.setRetentionMinutes);
  const [profileExportPicker, setProfileExportPicker] = useState(false);
  const [profileImportPicker, setProfileImportPicker] = useState(false);
  const prefs = usePreferencesStore();

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

  // A "settings profile" is deliberately narrower than the full
  // Backup above — just the appearance/behavior preferences, not the
  // virtual filesystem or the PIN — so it's safe to hand to someone
  // else, or to carry your look-and-feel to a fresh install without
  // dragging your whole file tree along.
  async function onExportProfile(result: { path: string } | { dir: string; name: string }) {
    setProfileExportPicker(false);
    if (!("dir" in result) || !window.anchoran) return;
    const { hydrated: _hydrated, lockPin: _lockPin, ...portable } = prefs;
    const filePath = `${result.dir}\\${result.name}`;
    const write = await window.anchoran.fsWriteTextFile(filePath, JSON.stringify(portable, null, 2));
    setStatus(write.success ? `Settings profile exported to ${filePath}` : write.error ?? "Couldn't export.");
  }

  async function onImportProfile(result: { path: string } | { dir: string; name: string }) {
    setProfileImportPicker(false);
    if (!("path" in result) || !window.anchoran) return;
    const read = await window.anchoran.fsReadTextFile(result.path);
    if (!("content" in read)) {
      setStatus(read.error);
      return;
    }
    try {
      const parsed = JSON.parse(read.content);
      if (typeof parsed.themeMode === "string") prefs.setThemeMode(parsed.themeMode);
      if (typeof parsed.accentColor === "string") prefs.setAccentColor(parsed.accentColor);
      if (typeof parsed.wallpaperId === "string") prefs.setWallpaper(parsed.wallpaperId);
      if (typeof parsed.customWallpaperDataUrl === "string") prefs.setCustomWallpaper(parsed.customWallpaperDataUrl);
      if (typeof parsed.uiScale === "number") prefs.setUiScale(parsed.uiScale);
      if (typeof parsed.animationsEnabled === "boolean") prefs.setAnimationsEnabled(parsed.animationsEnabled);
      if (typeof parsed.soundEnabled === "boolean") prefs.setSoundEnabled(parsed.soundEnabled);
      if (typeof parsed.soundVolume === "number") prefs.setSoundVolume(parsed.soundVolume);
      if (typeof parsed.highContrast === "boolean") prefs.setHighContrast(parsed.highContrast);
      if (typeof parsed.largeText === "boolean") prefs.setLargeText(parsed.largeText);
      setStatus("Settings profile imported.");
    } catch {
      setStatus("That file isn't a valid Anchoran settings profile.");
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
          <div className="settings-row-label">Settings profile</div>
          <div className="settings-row-desc">Just your appearance and behavior preferences — theme, accent, wallpaper, sound, scale — not your files or PIN. Safe to share or carry to a fresh install.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="app-toolbar-btn" onClick={() => setProfileExportPicker(true)}>Export…</button>
          <button className="app-toolbar-btn" onClick={() => setProfileImportPicker(true)}>Import…</button>
        </div>
      </div>
      <div className="settings-row">
        <div>
          <div className="settings-row-label">Clipboard auto-clear</div>
          <div className="settings-row-desc">Automatically forget clipboard history older than this, for anything sensitive that briefly passes through it.</div>
        </div>
        <select
          className="app-toolbar-btn"
          value={retentionMinutes}
          onChange={(e) => setRetentionMinutes(Number(e.target.value))}
        >
          <option value={0}>Never</option>
          <option value={5}>After 5 minutes</option>
          <option value={30}>After 30 minutes</option>
          <option value={60}>After 1 hour</option>
          <option value={1440}>After 1 day</option>
        </select>
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
            <button className="app-toolbar-btn" style={{ color: "#D64545" }} onClick={() => setResetPinPrompt(true)}>
              Confirm reset
            </button>
          </div>
        )}
      </div>
      {status && <p style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>{status}</p>}
      <RecentChangesRow />
      {profileExportPicker && (
        <AnchoranFilePicker
          mode="save"
          title="Export settings profile"
          defaultName="anchoran-settings-profile.json"
          onConfirm={onExportProfile}
          onCancel={() => setProfileExportPicker(false)}
        />
      )}
      {profileImportPicker && (
        <AnchoranFilePicker
          mode="open"
          title="Import settings profile"
          extensions={[".json"]}
          onConfirm={onImportProfile}
          onCancel={() => setProfileImportPicker(false)}
        />
      )}
      {resetPinPrompt && (
        <AdminPinPrompt
          onCancel={() => setResetPinPrompt(false)}
          onSuccess={() => {
            setResetPinPrompt(false);
            onReset();
          }}
        />
      )}
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

      <StartupAppsRow />
    </>
  );
}

/** Chooses which of Anchoran's own apps reopen every time Anchoran boots, and whether each starts minimized — distinct from the "Startup Apps" app, which manages real Windows Run-key programs. */
function StartupAppsRow() {
  const items = useAnchoranStartupAppsStore((s) => s.items);
  const addItem = useAnchoranStartupAppsStore((s) => s.addItem);
  const removeItem = useAnchoranStartupAppsStore((s) => s.removeItem);
  const toggleMinimized = useAnchoranStartupAppsStore((s) => s.toggleMinimized);
  const installed = useInstalledAppsStore((s) => s.installed);
  const [addingAppId, setAddingAppId] = useState<AppId | "">("");
  const candidates = APP_LIST.filter((a) => installed.has(a.id) && !items.some((i) => i.appId === a.id));

  return (
    <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <div>
        <div className="settings-row-label">Anchoran apps at startup</div>
        <div className="settings-row-desc">Reopen these apps every time Anchoran itself boots, minimized or not.</div>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>Nothing set to reopen.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
          {items.map((item) => (
            <div key={item.appId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, fontSize: 12.5 }}>{APP_REGISTRY[item.appId]?.title ?? item.appId}</span>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--anchoran-text-secondary)" }}>
                <input type="checkbox" checked={item.minimized} onChange={() => toggleMinimized(item.appId)} />
                Start minimized
              </label>
              <button className="app-toolbar-btn" onClick={() => removeItem(item.appId)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {candidates.length > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          <select value={addingAppId} onChange={(e) => setAddingAppId(e.target.value as AppId)} style={inputStyle}>
            <option value="">Add an app…</option>
            {candidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
          <button
            className="app-toolbar-btn"
            disabled={!addingAppId}
            onClick={() => {
              if (addingAppId) addItem(addingAppId);
              setAddingAppId("");
            }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function AboutSection() {
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [downloadedVersion, setDownloadedVersion] = useState<string | null>(null);
  const [diagnosticsPicker, setDiagnosticsPicker] = useState(false);
  const [betaChannel, setBetaChannelState] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [releaseNotesLoading, setReleaseNotesLoading] = useState(false);
  const pushNotification = useNotificationStore((s) => s.push);

  // Release notes, in the app — the same raw CHANGELOG.md the
  // Terminal's own `anchoran changelog` command already fetches, just
  // surfaced as a real panel instead of only ever plain-text output,
  // and defaulting to the version actually running right now.
  async function showReleaseNotes() {
    setReleaseNotesLoading(true);
    try {
      const res = await fetch("https://raw.githubusercontent.com/fachu2012/Anchoran-OS/main/CHANGELOG.md");
      const text = await res.text();
      const marker = `## [${ANCHORAN_VERSION}]`;
      const start = text.indexOf(marker);
      if (start === -1) {
        setReleaseNotes(`No changelog entry found for v${ANCHORAN_VERSION}.`);
        return;
      }
      const nextHeading = text.indexOf("\n## [", start + marker.length);
      setReleaseNotes(text.slice(start, nextHeading === -1 ? undefined : nextHeading).trim());
    } catch {
      setReleaseNotes("Couldn't reach GitHub to fetch the release notes.");
    } finally {
      setReleaseNotesLoading(false);
    }
  }

  useEffect(() => {
    window.anchoran?.getBetaChannel().then(setBetaChannelState);
  }, []);

  async function toggleBetaChannel(enabled: boolean) {
    setBetaChannelState(enabled);
    await window.anchoran?.setBetaChannel(enabled);
  }

  async function onDiagnosticsConfirm(result: { path: string } | { dir: string; name: string }) {
    setDiagnosticsPicker(false);
    if (!("dir" in result) || !window.anchoran) return;
    const [sysInfo, logLines] = await Promise.all([
      window.anchoran.getSystemInfo(),
      window.anchoran.readLog(),
    ]);
    const report = [
      `Anchoran OS diagnostics — ${new Date().toLocaleString()}`,
      `Version: ${ANCHORAN_VERSION}`,
      sysInfo ? `Platform: ${sysInfo.platform} ${sysInfo.arch}` : "",
      sysInfo ? `CPU: ${sysInfo.cpuModel} (${sysInfo.cpuCores} cores) — ${sysInfo.cpuUsagePercent}%` : "",
      sysInfo ? `Memory: ${sysInfo.totalMemMB - sysInfo.freeMemMB} / ${sysInfo.totalMemMB} MB` : "",
      "",
      "--- Last 200 log lines ---",
      ...(logLines ?? []).slice(0, 200),
    ]
      .filter(Boolean)
      .join("\n");
    const name = /\.[^.\\/]+$/.test(result.name) ? result.name : `${result.name}.txt`;
    const write = await window.anchoran.fsWriteTextFile(`${result.dir}\\${name}`, report);
    pushNotification("Settings", write.success ? "Diagnostics exported." : write.error ?? "Couldn't export diagnostics.");
  }

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
      <AnchoranLogo size={56} color="var(--anchoran-accent)" style={{ marginBottom: 14 }} />
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
          <button
            className="app-toolbar-btn"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("anchoran-request-update-theater", { detail: downloadedVersion }))
            }
          >
            Restart & install v{downloadedVersion}
          </button>
        )}
        <button className="app-toolbar-btn" onClick={() => setDiagnosticsPicker(true)}>
          Export diagnostics…
        </button>
        <button className="app-toolbar-btn" onClick={showReleaseNotes} disabled={releaseNotesLoading}>
          What's new
        </button>
      </div>
      <div className="settings-row">
        <div>
          <div className="settings-row-label">Beta channel</div>
          <div className="settings-row-desc">
            Also install pre-release updates, not just full releases. There's nothing on the
            beta channel yet — this just gets you the first one the moment it exists.
          </div>
        </div>
        <input type="checkbox" checked={betaChannel} onChange={(e) => toggleBetaChannel(e.target.checked)} />
      </div>
      {updateStatus && (
        <p style={{ fontSize: 12, color: "var(--anchoran-text-secondary)", marginTop: 8 }}>{updateStatus}</p>
      )}
      <UpdateHistoryList />
      {diagnosticsPicker && (
        <AnchoranFilePicker
          mode="save"
          title="Export diagnostics"
          defaultName="anchoran-diagnostics.txt"
          onConfirm={onDiagnosticsConfirm}
          onCancel={() => setDiagnosticsPicker(false)}
        />
      )}
      {releaseNotes !== null && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setReleaseNotes(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(90%, 560px)",
              maxHeight: "78vh",
              overflowY: "auto",
              background: "var(--anchoran-surface)",
              borderRadius: "var(--anchoran-radius-lg)",
              boxShadow: "var(--anchoran-shadow-window)",
              padding: 22,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>What's new</span>
              <button className="app-toolbar-btn" onClick={() => setReleaseNotes(null)}>Close</button>
            </div>
            <div className="notes-preview" style={{ padding: 0 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(releaseNotes) }} />
          </div>
        </div>
      )}
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
