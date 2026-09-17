import { create } from "zustand";
import type { AnchoranPreferences } from "@/core/types";
import { persistGet, persistSet } from "@/core/persist";

const STORAGE_KEY = "preferences";

export const DEFAULT_PREFERENCES: AnchoranPreferences = {
  themeMode: "dark",
  accentColor: "#6E9BF7",
  wallpaperId: "default",
  animationsEnabled: true,
  username: "user",
  soundEnabled: true,
  soundVolume: 0.6,
  lockPin: null,
  avatarDataUrl: null,
  customWallpaperDataUrl: null,
  onboardingComplete: false,
  nightLightEnabled: false,
  brightness: 1,
  highContrast: false,
  autoLockMinutes: 0,
};

interface PreferencesState extends AnchoranPreferences {
  hydrated: boolean;
  setThemeMode: (mode: AnchoranPreferences["themeMode"]) => void;
  setAccentColor: (color: string) => void;
  setWallpaper: (wallpaperId: string) => void;
  setCustomWallpaper: (dataUrl: string) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setUsername: (name: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  setLockPin: (pin: string | null) => void;
  setAvatar: (dataUrl: string | null) => void;
  completeOnboarding: () => void;
  setNightLightEnabled: (enabled: boolean) => void;
  setBrightness: (brightness: number) => void;
  setHighContrast: (enabled: boolean) => void;
  setAutoLockMinutes: (minutes: number) => void;
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
    animationsEnabled: s.animationsEnabled,
    username: s.username,
    soundEnabled: s.soundEnabled,
    soundVolume: s.soundVolume,
    lockPin: s.lockPin,
    avatarDataUrl: s.avatarDataUrl,
    customWallpaperDataUrl: s.customWallpaperDataUrl,
    onboardingComplete: s.onboardingComplete,
    nightLightEnabled: s.nightLightEnabled,
    brightness: s.brightness,
    highContrast: s.highContrast,
    autoLockMinutes: s.autoLockMinutes,
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
  setCustomWallpaper: (customWallpaperDataUrl) => {
    set({ customWallpaperDataUrl, wallpaperId: "custom" });
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
  setAvatar: (avatarDataUrl) => {
    set({ avatarDataUrl });
    persist(get());
  },
  completeOnboarding: () => {
    set({ onboardingComplete: true });
    persist(get());
  },
  setNightLightEnabled: (nightLightEnabled) => {
    set({ nightLightEnabled });
    persist(get());
  },
  setBrightness: (brightness) => {
    set({ brightness });
    persist(get());
  },
  setHighContrast: (highContrast) => {
    set({ highContrast });
    persist(get());
  },
  setAutoLockMinutes: (autoLockMinutes) => {
    set({ autoLockMinutes });
    persist(get());
  },
}));

persistGet<AnchoranPreferences>("config", STORAGE_KEY, DEFAULT_PREFERENCES).then((loaded) => {
  usePreferencesStore.setState({ ...DEFAULT_PREFERENCES, ...loaded, hydrated: true });
});
