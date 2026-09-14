import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import type { AppId } from "@/core/types";
import { LEGACY_APP_ID_SET } from "@/core/legacyAppIds";

/**
 * Desktop icons come in two flavors: pinned app shortcuts (persisted as
 * a plain AppId list) and the user's real Windows Desktop folder
 * (fetched live via window.anchoran.fsListDir — see DesktopIcons.tsx),
 * i.e. actual files and folders on disk. Both kinds can be freely
 * dragged around the wallpaper; a manually-set position is kept in
 * `positions` keyed by `app:<id>` or `file:<realPath>`, and anything
 * without one falls back to an automatic grid slot computed by the
 * component.
 */

const PINNED_KEY = "desktopPinnedApps";
const POSITIONS_KEY = "desktopIconPositions";

const DEFAULT_PINNED: AppId[] = ["files", "terminal", "settings", "recycleBin"];

export type IconKey = `app:${string}` | `file:${string}` | `shortcut:${string}`;

interface DesktopIconsState {
  pinnedApps: AppId[];
  positions: Record<string, { x: number; y: number }>;
  hydrated: boolean;
  pinApp: (appId: AppId) => void;
  unpinApp: (appId: AppId) => void;
  setPosition: (key: IconKey, x: number, y: number) => void;
  clearPositions: () => void;
}

function persist(pinnedApps: AppId[], positions: Record<string, { x: number; y: number }>) {
  persistSet("config", PINNED_KEY, pinnedApps);
  persistSet("config", POSITIONS_KEY, positions);
}

export const useDesktopIconsStore = create<DesktopIconsState>((set, get) => ({
  pinnedApps: DEFAULT_PINNED,
  positions: {},
  hydrated: false,

  pinApp: (appId) => {
    if (get().pinnedApps.includes(appId)) return;
    const pinnedApps = [...get().pinnedApps, appId];
    set({ pinnedApps });
    persist(pinnedApps, get().positions);
  },

  unpinApp: (appId) => {
    const pinnedApps = get().pinnedApps.filter((id) => id !== appId);
    set({ pinnedApps });
    persist(pinnedApps, get().positions);
  },

  setPosition: (key, x, y) => {
    const positions = { ...get().positions, [key]: { x, y } };
    set({ positions });
    persist(get().pinnedApps, positions);
  },

  clearPositions: () => {
    set({ positions: {} });
    persist(get().pinnedApps, {});
  },
}));

Promise.all([
  persistGet<AppId[]>("config", PINNED_KEY, DEFAULT_PINNED),
  persistGet<Record<string, { x: number; y: number }>>("config", POSITIONS_KEY, {}),
]).then(([loadedPinned, positions]) => {
  // See taskbarStore.ts's identical guard: a pin from before the
  // Anchoran App SDK migration can still name a now-removed app id.
  const pinnedApps = loadedPinned.filter((id) => !LEGACY_APP_ID_SET.has(id));
  useDesktopIconsStore.setState({ pinnedApps, positions, hydrated: true });
  if (pinnedApps.length !== loadedPinned.length) persist(pinnedApps, positions);
});
