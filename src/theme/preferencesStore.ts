import { create } from "zustand";
import type { AnchoranPreferences } from "@/core/types";

const STORAGE_KEY = "anchoran.preferences.v1";

const DEFAULT_PREFERENCES: AnchoranPreferences = {
  themeMode: "light",
  accentColor: "#1E3A8A",
  wallpaperId: "default",
  uiScale: 1,
  animationsEnabled: true,
  username: "user",
};

function loadPreferences(): AnchoranPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function persist(prefs: AnchoranPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable (e.g. restrictive environment) — Anchoran
    // degrades gracefully to in-memory-only preferences for the session.
  }
}

interface PreferencesState extends AnchoranPreferences {
  setThemeMode: (mode: AnchoranPreferences["themeMode"]) => void;
  setAccentColor: (color: string) => void;
  setWallpaper: (wallpaperId: string) => void;
  setUiScale: (scale: number) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setUsername: (name: string) => void;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...loadPreferences(),

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
}));
