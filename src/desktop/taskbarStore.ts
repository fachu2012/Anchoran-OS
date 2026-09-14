import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import type { AppId } from "@/core/types";
import { LEGACY_APP_ID_SET } from "@/core/legacyAppIds";

const PINNED_KEY = "pinnedApps";
const DEFAULT_PINNED: AppId[] = ["files", "terminal", "browser", "notes", "settings"];

interface TaskbarState {
  pinned: AppId[];
  hydrated: boolean;
  pin: (appId: AppId) => void;
  unpin: (appId: AppId) => void;
  /** Moves the pinned app at `fromIndex` to `toIndex` (drag-to-reorder). */
  reorder: (fromIndex: number, toIndex: number) => void;
}

function persist(pinned: AppId[]) {
  persistSet("config", PINNED_KEY, pinned);
}

export const useTaskbarStore = create<TaskbarState>((set, get) => ({
  pinned: DEFAULT_PINNED,
  hydrated: false,

  pin: (appId) => {
    if (get().pinned.includes(appId)) return;
    const pinned = [...get().pinned, appId];
    set({ pinned });
    persist(pinned);
  },

  unpin: (appId) => {
    const pinned = get().pinned.filter((id) => id !== appId);
    set({ pinned });
    persist(pinned);
  },

  reorder: (fromIndex, toIndex) => {
    const pinned = [...get().pinned];
    const [moved] = pinned.splice(fromIndex, 1);
    pinned.splice(toIndex, 0, moved);
    set({ pinned });
    persist(pinned);
  },
}));

persistGet<AppId[]>("config", PINNED_KEY, DEFAULT_PINNED).then((loaded) => {
  // A pin from before the Anchoran App SDK migration (see CHANGELOG)
  // can still name an app id that no longer exists — dropped here so
  // the taskbar never renders a pin for an app AppComponents has no
  // entry for.
  const pinned = loaded.filter((id) => !LEGACY_APP_ID_SET.has(id));
  useTaskbarStore.setState({ pinned, hydrated: true });
  if (pinned.length !== loaded.length) persist(pinned);
});
