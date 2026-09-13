import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import type { AppId } from "@/core/types";

/**
 * Desktop shortcuts that carry real launch parameters — not just "open
 * this app" (that's desktopIconsStore's plain pinned-app icons), but
 * "open this app already elevated" or "open the browser straight to
 * this URL". A separate store because a parametrized shortcut can
 * exist alongside a plain pin of the very same app.
 */
export interface ParametrizedShortcut {
  id: string;
  appId: AppId;
  title: string;
  openPath?: string;
  startAdmin?: boolean;
}

const KEY = "parametrizedShortcuts";

interface ShortcutsState {
  shortcuts: ParametrizedShortcut[];
  addShortcut: (shortcut: Omit<ParametrizedShortcut, "id">) => void;
  removeShortcut: (id: string) => void;
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
  shortcuts: [],

  addShortcut: (shortcut) => {
    const shortcuts = [...get().shortcuts, { ...shortcut, id: `shortcut-${Date.now()}` }];
    set({ shortcuts });
    persistSet("config", KEY, shortcuts);
  },

  removeShortcut: (id) => {
    const shortcuts = get().shortcuts.filter((s) => s.id !== id);
    set({ shortcuts });
    persistSet("config", KEY, shortcuts);
  },
}));

persistGet<ParametrizedShortcut[]>("config", KEY, []).then((shortcuts) => {
  useShortcutsStore.setState({ shortcuts });
});
