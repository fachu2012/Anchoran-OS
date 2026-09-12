import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import type { AppId } from "@/core/types";

/**
 * Per-app volume mixer — independent of the system sounds volume in
 * Settings → Sound (that's only for Anchoran's own login/notification/
 * error chimes). This covers every app that can actually play audio:
 * Browser and Chat (real `<webview>` guest pages, controlled via
 * `setAudioMuted` + an injected volume on their own media elements)
 * and Media Player (a normal `<audio>`/`<video>` element in Anchoran's
 * own renderer, controlled directly).
 */
export const MIXER_APP_IDS: AppId[] = ["browser", "chat", "mediaPlayer"];

interface AppVolume {
  volume: number; // 0..1
  muted: boolean;
}

const STORAGE_KEY = "volumeMixer";
const DEFAULT_VOLUME: AppVolume = { volume: 1, muted: false };

interface VolumeMixerState {
  levels: Record<string, AppVolume>;
  hydrated: boolean;
  getLevel: (appId: AppId) => AppVolume;
  setVolume: (appId: AppId, volume: number) => void;
  setMuted: (appId: AppId, muted: boolean) => void;
}

function persist(levels: Record<string, AppVolume>) {
  persistSet("config", STORAGE_KEY, levels);
}

export const useVolumeMixerStore = create<VolumeMixerState>((set, get) => ({
  levels: {},
  hydrated: false,

  getLevel: (appId) => get().levels[appId] ?? DEFAULT_VOLUME,

  setVolume: (appId, volume) => {
    const levels = { ...get().levels, [appId]: { ...get().getLevel(appId), volume } };
    set({ levels });
    persist(levels);
  },

  setMuted: (appId, muted) => {
    const levels = { ...get().levels, [appId]: { ...get().getLevel(appId), muted } };
    set({ levels });
    persist(levels);
  },
}));

persistGet<Record<string, AppVolume>>("config", STORAGE_KEY, {}).then((levels) => {
  useVolumeMixerStore.setState({ levels, hydrated: true });
});
