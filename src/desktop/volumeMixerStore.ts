import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import type { AppId } from "@/core/types";

/**
 * Per-app volume mixer — independent of the system sounds volume in
 * Settings → Sound (that's only for Anchoran's own login/notification/
 * error chimes). This covers every remaining bundled app that can
 * actually play audio: Browser (a real `<webview>` guest page,
 * controlled via `setAudioMuted` + an injected volume on its own media
 * elements) and Media Player (a normal `<audio>`/`<video>` element in
 * Anchoran's own renderer, controlled directly). Chat used to be a
 * third `<webview>` here too — it moved to a Webstore plugin (see
 * CHANGELOG's Anchoran App SDK migration) and isn't a bundled app
 * anymore, so it's no longer in this list; a plugin has no equivalent
 * OS-level volume mixer hook.
 */
export const MIXER_APP_IDS: AppId[] = ["browser", "mediaPlayer"];

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
