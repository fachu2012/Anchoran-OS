/** Shared cross-module types for Anchoran OS. */

export type AppId =
  | "files"
  | "terminal"
  | "settings"
  | "notes"
  | "calculator"
  | "browser"
  | "systemMonitor"
  | "appCenter";

export interface AppDefinition {
  id: AppId;
  title: string;
  /** Icon key resolved against src/assets/icons registry. */
  icon: string;
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
}
