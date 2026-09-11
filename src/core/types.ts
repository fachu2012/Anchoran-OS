/** Shared cross-module types for Anchoran OS. */

export type AppId =
  | "files"
  | "terminal"
  | "settings"
  | "notes"
  | "calculator"
  | "browser"
  | "systemMonitor"
  | "appCenter"
  | "clock"
  | "converter"
  | "colorPicker";

export type AppCategory = "System" | "Productivity" | "Utilities" | "Internet";

export interface AppDefinition {
  id: AppId;
  title: string;
  /** Icon key resolved against src/assets/icons registry. */
  icon: string;
  category: AppCategory;
  description: string;
  /** Whether this app can have more than one open window at once. */
  allowMultipleInstances?: boolean;
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
}

export type ThemeMode = "light" | "dark";

export type AccentColor = string;

export interface AnchoranPreferences {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  wallpaperId: string;
  uiScale: number;
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
}
