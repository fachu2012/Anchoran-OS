import { useState } from "react";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { ANCHORAN_VERSION } from "@/core/version";
import { WALLPAPERS } from "@/desktop/wallpapers";
import "@/applications/apps.css";

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

const ACCENTS = ["#1E3A8A", "#5B8DEF", "#0F766E", "#7C3AED", "#B45309", "#334155"];

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
        )}

        {section === "Sound" && (
          <p style={{ color: "var(--anchoran-text-secondary)" }}>
            No audio devices configured yet. Sound settings will appear here.
          </p>
        )}
        {section === "Network" && (
          <p style={{ color: "var(--anchoran-text-secondary)" }}>
            Network status is managed by Windows; Anchoran reflects it in the system bar.
          </p>
        )}
        {section === "Notifications" && (
          <p style={{ color: "var(--anchoran-text-secondary)" }}>
            Manage how Anchoran surfaces notifications from its applications.
          </p>
        )}
        {section === "Users" && (
          <div className="settings-row">
            <div className="settings-row-label">Username</div>
            <input
              value={prefs.username}
              onChange={(e) => prefs.setUsername(e.target.value)}
              style={{
                background: "var(--anchoran-bg)",
                border: "1px solid var(--anchoran-border)",
                borderRadius: 6,
                padding: "6px 10px",
                color: "var(--anchoran-text-primary)",
              }}
            />
          </div>
        )}
        {section === "Privacy" && (
          <p style={{ color: "var(--anchoran-text-secondary)" }}>
            Anchoran's data stays local to its own filesystem and never touches host Windows files.
          </p>
        )}
        {section === "System" && (
          <p style={{ color: "var(--anchoran-text-secondary)" }}>
            Anchoran OS {ANCHORAN_VERSION} — running as a shell application on top of Windows.
          </p>
        )}
        {section === "About" && (
          <div>
            <h2 style={{ margin: "0 0 4px", fontWeight: 500 }}>Anchoran OS</h2>
            <p style={{ color: "var(--anchoran-text-secondary)", marginTop: 0 }}>Version {ANCHORAN_VERSION}</p>
          </div>
        )}
      </div>
    </div>
  );
}
