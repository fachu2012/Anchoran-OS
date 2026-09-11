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

function persist(prefs: AnchoranPreferences) {
  persistSet("config", STORAGE_KEY, prefs);
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...DEFAULT_PREFERENCES,
  hydrated: false,

  setThemeMode: (themeMode) => {
    set({ themeMode });
    persist({ ...get(), themeMode });
  },
  setAccentColor: (accentColor) => {
    set({ accentColor });
    persist({ ...get(), accentColor });
  },
  setWallpaper: (wallpaperId) => {
    set({ wallpaperId });
    persist({ ...get(), wallpaperId });
  },
  setUiScale: (uiScale) => {
    set({ uiScale });
    persist({ ...get(), uiScale });
  },
  setAnimationsEnabled: (animationsEnabled) => {
    set({ animationsEnabled });
    persist({ ...get(), animationsEnabled });
  },
  setUsername: (username) => {
    set({ username });
    persist({ ...get(), username });
  },
  setSoundEnabled: (soundEnabled) => {
    set({ soundEnabled });
    persist({ ...get(), soundEnabled });
  },
  setSoundVolume: (soundVolume) => {
    set({ soundVolume });
    persist({ ...get(), soundVolume });
  },
  setLockPin: (lockPin) => {
    set({ lockPin });
    persist({ ...get(), lockPin });
  },
}));

persistGet<AnchoranPreferences>("config", STORAGE_KEY, DEFAULT_PREFERENCES).then((loaded) => {
  usePreferencesStore.setState({ ...DEFAULT_PREFERENCES, ...loaded, hydrated: true });
});
