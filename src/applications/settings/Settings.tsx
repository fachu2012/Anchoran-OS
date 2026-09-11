import { useEffect, useState, type CSSProperties } from "react";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { useNotificationStore } from "@/notifications/notificationStore";
import { ANCHORAN_VERSION } from "@/core/version";
import { WALLPAPERS } from "@/desktop/wallpapers";
import { playNotificationSound } from "@/core/sound";
import { useUpdateHistoryStore } from "@/core/updateHistory";
import "@/applications/apps.css";

const ANCHORAN_LOGO = new URL("../../../assets/logo/anchoran-logo.svg", import.meta.url).href;

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
  "About",
] as const;

const ACCENTS = ["#6E9BF7", "#1E3A8A", "#0F766E", "#7C3AED", "#B45309", "#94A3B8"];

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

  return (
    <div className="settings-root">
      <nav className="settings-nav">
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
            </div>
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

        {section === "About" && <AboutSection />}
      </div>
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

  return (
    <>
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
      <img src={ANCHORAN_LOGO} alt="" width={40} height={40} style={{ marginBottom: 10 }} />
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
