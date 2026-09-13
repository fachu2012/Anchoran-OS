import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import type { AppId } from "@/core/types";

const KEY = "appUsage";

interface AppUsageState {
  /** Open count and last-opened time per app, from the Launcher only — enough to surface a real "most used" row without needing a separate telemetry system. `lastUsed` is a monotonic sequence number, not a wall-clock timestamp — Date.now() has only millisecond resolution, which two rapid opens can land on the same tick and tie, while a counter never can. */
  usage: Partial<Record<AppId, { count: number; lastUsed: number }>>;
  record: (appId: AppId) => void;
  topApps: (limit: number) => AppId[];
}

let recordSeq = 0;

export const useAppUsageStore = create<AppUsageState>((set, get) => ({
  usage: {},

  record: (appId) => {
    recordSeq += 1;
    const current = get().usage[appId];
    const usage = { ...get().usage, [appId]: { count: (current?.count ?? 0) + 1, lastUsed: recordSeq } };
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
  // Keeps the sequence counter ahead of every persisted value, so an
  // app recorded for the first time this session still sorts after
  // whatever was already the most recent before this launch, instead
  // of restarting from 0 and losing that ordering.
  recordSeq = Math.max(0, ...Object.values(usage).map((v) => v?.lastUsed ?? 0));
});
