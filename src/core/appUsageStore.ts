import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import type { AppId } from "@/core/types";

const KEY = "appUsage";

interface AppUsageState {
  /** Open count and last-opened time per app, from the Launcher only — enough to surface a real "most used" row without needing a separate telemetry system. */
  usage: Partial<Record<AppId, { count: number; lastUsed: number }>>;
  record: (appId: AppId) => void;
  topApps: (limit: number) => AppId[];
}

export const useAppUsageStore = create<AppUsageState>((set, get) => ({
  usage: {},

  record: (appId) => {
    const current = get().usage[appId];
    const usage = { ...get().usage, [appId]: { count: (current?.count ?? 0) + 1, lastUsed: Date.now() } };
    set({ usage });
    persistSet("config", KEY, usage);
  },

  topApps: (limit) => {
    return Object.entries(get().usage)
      .sort((a, b) => b[1]!.count - a[1]!.count || b[1]!.lastUsed - a[1]!.lastUsed)
      .slice(0, limit)
      .map(([appId]) => appId as AppId);
  },
}));

persistGet<Partial<Record<AppId, { count: number; lastUsed: number }>>>("config", KEY, {}).then((usage) => {
  useAppUsageStore.setState({ usage });
});
