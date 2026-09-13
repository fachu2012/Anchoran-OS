import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { WALLPAPERS } from "@/desktop/wallpapers";

const ENABLED_KEY = "wallpaperSpotlightEnabled";
const LAST_ROTATED_KEY = "wallpaperSpotlightLastRotated";
const ROTATE_EVERY_MS = 24 * 60 * 60 * 1000;

interface WallpaperSpotlightState {
  enabled: boolean;
  lastRotatedAt: number;
  setEnabled: (enabled: boolean) => void;
  rotateNow: () => void;
}

/** A wallpaper that changes itself day to day, like Windows Spotlight — cycles through Anchoran's own built-in wallpapers rather than fetching new ones from anywhere online. */
export const useWallpaperSpotlightStore = create<WallpaperSpotlightState>((set, get) => ({
  enabled: false,
  lastRotatedAt: 0,

  setEnabled: (enabled) => {
    set({ enabled });
    persistSet("config", ENABLED_KEY, enabled);
    if (enabled) get().rotateNow();
  },

  rotateNow: () => {
    const current = usePreferencesStore.getState().wallpaperId;
    const choices = WALLPAPERS.filter((w) => w.id !== current);
    const next = choices[Math.floor(Math.random() * choices.length)] ?? WALLPAPERS[0];
    usePreferencesStore.getState().setWallpaper(next.id);
    const lastRotatedAt = Date.now();
    set({ lastRotatedAt });
    persistSet("config", LAST_ROTATED_KEY, lastRotatedAt);
  },
}));

Promise.all([
  persistGet<boolean>("config", ENABLED_KEY, false),
  persistGet<number>("config", LAST_ROTATED_KEY, 0),
]).then(([enabled, lastRotatedAt]) => {
  useWallpaperSpotlightStore.setState({ enabled, lastRotatedAt });
  if (enabled && Date.now() - lastRotatedAt >= ROTATE_EVERY_MS) {
    useWallpaperSpotlightStore.getState().rotateNow();
  }
});
