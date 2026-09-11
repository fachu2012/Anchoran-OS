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
  | "colorPicker"
  | "chat"
  | "todo"
  | "pomodoro"
  | "qrCode"
  | "passwordGenerator"
  | "jsonFormatter"
  | "wordCounter"
  | "snake"
  | "game2048"
  | "ticTacToe"
  | "memoryMatch"
  | "diceRoller"
  | "coinFlip"
  | "connectFour"
  | "checkers"
  | "minesweeper"
  | "sudoku"
  | "typingTest"
  | "calendar"
  | "clipboardManager"
  | "kanban"
  | "textDiff"
  | "habitTracker"
  | "currencyConverter"
  | "weather"
  | "passwordVault"
  | "reminders"
  | "ttsReader"
  | "mindMap"
  | "solitaire"
  | "chess"
  | "paint"
  | "pixelArt"
  | "wallpaperMaker"
  | "photoViewer"
  | "screenshot"
  | "voiceRecorder"
  | "networkMonitor"
  | "eventViewer"
  | "mediaPlayer"
  | "zipTool"
  | "spreadsheet"
  | "magnifier"
  | "screenRecorder";

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
  /** Night Light: warms the whole display with an amber tint, like Windows' own blue-light filter. */
  nightLightEnabled: boolean;
  /** Screen brightness simulation, 0.5 (dim) to 1 (full) — applied as a CSS filter over the whole desktop. */
  brightness: number;
  /** Accessibility: stronger borders/contrast and flatter colors throughout the UI. */
  highContrast: boolean;
  /** Accessibility: scales up UI text beyond what uiScale alone affects. */
  largeText: boolean;
  /** Minutes of inactivity before Anchoran auto-locks; 0 disables it. Only takes effect once a PIN is set. */
  autoLockMinutes: number;
}
