import { create } from "zustand";
import type { AnchoranPreferences } from "@/core/types";
import { persistGet, persistSet } from "@/core/persist";

const STORAGE_KEY = "preferences";

const DEFAULT_PREFERENCES: AnchoranPreferences = {
  themeMode: "dark",
  accentColor: "#6E9BF7",
  wallpaperId: "default",
  uiScale: 1,
  animationsEnabled: true,
  username: "user",
  soundEnabled: true,
  soundVolume: 0.6,
  lockPin: null,
};

interface PreferencesState extends AnchoranPreferences {
  hydrated: boolean;
  setThemeMode: (mode: AnchoranPreferences["themeMode"]) => void;
  setAccentColor: (color: string) => void;
  setWallpaper: (wallpaperId: string) => void;
  setUiScale: (scale: number) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setUsername: (name: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  setLockPin: (pin: string | null) => void;
}

/**
 * Picks only the plain-data preference fields out of the store state —
 * critically, NOT the setter functions Zustand's `get()` also returns.
 * Functions can't cross Electron's IPC boundary (contextBridge uses the
 * structured clone algorithm), so persisting `{ ...get(), field }`
 * directly silently failed to save anything, ever: every setter below
 * was affected. Always persist through this instead of spreading the
 * raw store state.
 */
function toPersistable(s: AnchoranPreferences): AnchoranPreferences {
  return {
    themeMode: s.themeMode,
    accentColor: s.accentColor,
    wallpaperId: s.wallpaperId,
    uiScale: s.uiScale,
    animationsEnabled: s.animationsEnabled,
    username: s.username,
    soundEnabled: s.soundEnabled,
    soundVolume: s.soundVolume,
    lockPin: s.lockPin,
  };
}

function persist(prefs: AnchoranPreferences) {
  persistSet("config", STORAGE_KEY, toPersistable(prefs));
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...DEFAULT_PREFERENCES,
  hydrated: false,

  setThemeMode: (themeMode) => {
    set({ themeMode });
    persist(get());
  },
  setAccentColor: (accentColor) => {
    set({ accentColor });
    persist(get());
  },
  setWallpaper: (wallpaperId) => {
    set({ wallpaperId });
    persist(get());
  },
  setUiScale: (uiScale) => {
    set({ uiScale });
    persist(get());
  },
  setAnimationsEnabled: (animationsEnabled) => {
    set({ animationsEnabled });
    persist(get());
  },
  setUsername: (username) => {
    set({ username });
    persist(get());
  },
  setSoundEnabled: (soundEnabled) => {
    set({ soundEnabled });
    persist(get());
  },
  setSoundVolume: (soundVolume) => {
    set({ soundVolume });
    persist(get());
  },
  setLockPin: (lockPin) => {
    set({ lockPin });
    persist(get());
  },
}));

persistGet<AnchoranPreferences>("config", STORAGE_KEY, DEFAULT_PREFERENCES).then((loaded) => {
  usePreferencesStore.setState({ ...DEFAULT_PREFERENCES, ...loaded, hydrated: true });
});
