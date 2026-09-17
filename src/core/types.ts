/** Shared cross-module types for Anchoran OS. */

/**
 * The still-bundled, installable Anchoran OS apps. This used to also
 * list every simple utility/game app (Calculator, Snake, Chess, …) —
 * as of the Anchoran App SDK migration (see CHANGELOG), those moved
 * out to standalone Webstore plugins instead (see PluginId below) and
 * are no longer part of this union. A device updating from an older
 * version may still have one of those old ids saved in a window
 * layout or installed-apps list; see `LEGACY_APP_IDS` in
 * src/core/legacyAppIds.ts for the full list this migration removed,
 * used to detect and clean up exactly that case (see
 * upgradeAppRemoval.ts) instead of crashing on an unknown id.
 */
export type AppId =
  | "files"
  | "terminal"
  | "settings"
  | "notes"
  | "browser"
  | "systemMonitor"
  | "appCenter"
  | "photoViewer"
  | "networkMonitor"
  | "eventViewer"
  | "mediaPlayer"
  | "storageUsage"
  | "startupApps"
  | "onScreenKeyboard"
  | "narrator"
  | "recycleBin"
  | "embeddedApp"
  | "anchover"
  | "releaseRanking"
  | "pluginHost"
  | "codeRunner";

export type AppCategory = "System" | "Productivity" | "Utilities" | "Internet" | "Games";

export interface AppDefinition {
  id: AppId;
  title: string;
  /** Icon key resolved against src/assets/icons registry. */
  icon: string;
  category: AppCategory;
  description: string;
  /** Core apps (Files, Terminal, Settings, the Webstore) are always
   *  installed and can't be removed — Anchoran isn't usable without
   *  them, the same way a real OS doesn't let you uninstall Explorer. */
  core?: boolean;
  /** Whether this app can have more than one open window at once. */
  allowMultipleInstances?: boolean;
  /** Never listed in the Launcher's app grid/browse-all or the Start search's fuzzy/partial matching — only found by typing its exact, full title, same as Windows' "winver" isn't pinned anywhere and only turns up if you type its exact name. Still a real, installed app otherwise: it opens normally, shows up in the taskbar, etc. */
  hiddenFromLauncher?: boolean;
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
}

export type ThemeMode = "light" | "dark";

export type AccentColor = string;

export interface AnchoranPreferences {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  wallpaperId: string;
  animationsEnabled: boolean;
  username: string;
  soundEnabled: boolean;
  soundVolume: number; // 0..1
  /**
   * A simple numeric PIN for the lock screen. This is a UX affordance
   * for the simulated OS experience, not a cryptographic security
   * boundary — it's stored as plain text in Anchoran's own local
   * config store, the same way a screensaver password would be.
   */
  lockPin: string | null;
  /** A small imported photo (data URL), shown on the lock screen and in Settings → Users. */
  avatarDataUrl: string | null;
  /** Set when wallpaperId is "custom" — an imported image (data URL) instead of a built-in gradient. */
  customWallpaperDataUrl: string | null;
  /** True once the first-run welcome wizard (username/PIN/avatar/wallpaper) has been completed or skipped. */
  onboardingComplete: boolean;
  /** Night Light: warms the whole display with an amber tint, like Windows' own blue-light filter. */
  nightLightEnabled: boolean;
  /** Screen brightness simulation, 0.5 (dim) to 1 (full) — applied as a CSS filter over the whole desktop. */
  brightness: number;
  /** Accessibility: stronger borders/contrast and flatter colors throughout the UI. */
  highContrast: boolean;
  /** Minutes of inactivity before Anchoran auto-locks; 0 disables it. Only takes effect once a PIN is set. */
  autoLockMinutes: number;
}
