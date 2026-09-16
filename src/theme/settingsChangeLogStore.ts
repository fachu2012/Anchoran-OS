import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import { usePreferencesStore } from "@/theme/preferencesStore";

export interface SettingsChangeEntry {
  id: string;
  timestamp: number;
  description: string;
}

const KEY = "settingsChangeLog";
const MAX_ENTRIES = 50;

interface SettingsChangeLogState {
  entries: SettingsChangeEntry[];
  record: (description: string) => void;
  clear: () => void;
}

/** A plain-language log of recent preference changes — not a full audit trail (that's adminAuditStore, owner-only and about elevation), just "what did I just change" for everyday settings. */
export const useSettingsChangeLogStore = create<SettingsChangeLogState>((set, get) => ({
  entries: [],
  record: (description) => {
    const entries = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: Date.now(), description }, ...get().entries].slice(
      0,
      MAX_ENTRIES
    );
    set({ entries });
    persistSet("config", KEY, entries);
  },
  clear: () => {
    set({ entries: [] });
    persistSet("config", KEY, []);
  },
}));

persistGet<SettingsChangeEntry[]>("config", KEY, []).then((entries) => {
  useSettingsChangeLogStore.setState({ entries });
});

// Which preferencesStore fields get logged, and under what plain-
// language name — deliberately excludes username/avatarDataUrl/lockPin
// (identity/security fields, not really "settings" in this sense, and
// not something to echo in a plain-text log).
const TRACKED_LABELS: Record<string, string> = {
  themeMode: "Theme",
  accentColor: "Accent color",
  wallpaperId: "Wallpaper",
  animationsEnabled: "Animations",
  soundEnabled: "System sounds",
  soundVolume: "Volume",
  nightLightEnabled: "Night Light",
  brightness: "Brightness",
  highContrast: "High contrast",
  largeText: "Large text",
  autoLockMinutes: "Auto-lock",
};

let previousSnapshot: Record<string, unknown> | null = null;
usePreferencesStore.subscribe((state) => {
  if (!state.hydrated) return;
  const snapshot = state as unknown as Record<string, unknown>;
  if (previousSnapshot === null) {
    // The first hydrated snapshot is the real starting point, not a
    // "change" from some prior in-memory default — nothing to log yet.
    previousSnapshot = { ...snapshot };
    return;
  }
  for (const key of Object.keys(TRACKED_LABELS)) {
    if (snapshot[key] !== previousSnapshot[key]) {
      useSettingsChangeLogStore.getState().record(`${TRACKED_LABELS[key]} changed`);
    }
  }
  previousSnapshot = { ...snapshot };
});
