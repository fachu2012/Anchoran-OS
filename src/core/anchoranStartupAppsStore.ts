import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import type { AppId } from "@/core/types";

export interface StartupAppEntry {
  appId: AppId;
  /** Opens minimized to the taskbar instead of on top of the desktop. */
  minimized: boolean;
}

const KEY = "anchoranStartupApps";

interface AnchoranStartupAppsState {
  items: StartupAppEntry[];
  addItem: (appId: AppId) => void;
  removeItem: (appId: AppId) => void;
  toggleMinimized: (appId: AppId) => void;
}

/**
 * Anchoran's own apps set to reopen every time Anchoran itself boots —
 * distinct from StartupApps.tsx, which manages real Windows programs
 * in the HKCU Run registry key. This is purely in-app: a Zustand store
 * read once at boot (see App.tsx's enterDesktop) to reopen each listed
 * app, minimized or not.
 */
export const useAnchoranStartupAppsStore = create<AnchoranStartupAppsState>((set, get) => ({
  items: [],

  addItem: (appId) => {
    if (get().items.some((i) => i.appId === appId)) return;
    const items = [...get().items, { appId, minimized: false }];
    set({ items });
    persistSet("config", KEY, items);
  },

  removeItem: (appId) => {
    const items = get().items.filter((i) => i.appId !== appId);
    set({ items });
    persistSet("config", KEY, items);
  },

  toggleMinimized: (appId) => {
    const items = get().items.map((i) => (i.appId === appId ? { ...i, minimized: !i.minimized } : i));
    set({ items });
    persistSet("config", KEY, items);
  },
}));

/** Resolves once the persisted list has actually loaded — App.tsx awaits this before reopening anything at boot, so a fresh, not-yet-hydrated empty array doesn't win the race. */
export const startupAppsReady: Promise<void> = persistGet<StartupAppEntry[]>("config", KEY, []).then((items) => {
  useAnchoranStartupAppsStore.setState({ items });
});
