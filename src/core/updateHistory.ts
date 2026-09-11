import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import { ANCHORAN_VERSION } from "@/core/version";

export interface UpdateHistoryEntry {
  fromVersion: string | null;
  toVersion: string;
  installedAt: number;
}

const HISTORY_KEY = "updateHistory";
const LAST_VERSION_KEY = "lastKnownVersion";

interface UpdateHistoryState {
  history: UpdateHistoryEntry[];
  hydrated: boolean;
}

export const useUpdateHistoryStore = create<UpdateHistoryState>(() => ({
  history: [],
  hydrated: false,
}));

/**
 * Anchoran doesn't rely on any single update mechanism to know it was
 * updated — it just compares the version it booted with last time to
 * the version it's booting with now, on every startup. Whether the
 * update happened via electron-updater, a manual reinstall, or the
 * fullscreen AnchoranSetup, it's detected the same way. Call once,
 * early in App startup.
 */
export async function recordUpdateIfVersionChanged(): Promise<void> {
  const [history, lastVersion] = await Promise.all([
    persistGet<UpdateHistoryEntry[]>("config", HISTORY_KEY, []),
    persistGet<string | null>("config", LAST_VERSION_KEY, null),
  ]);

  if (lastVersion !== ANCHORAN_VERSION) {
    const nextHistory =
      lastVersion === null
        ? history // first-ever launch: nothing "updated" yet, just record the baseline version below
        : [{ fromVersion: lastVersion, toVersion: ANCHORAN_VERSION, installedAt: Date.now() }, ...history].slice(
            0,
            50
          );
    persistSet("config", HISTORY_KEY, nextHistory);
    persistSet("config", LAST_VERSION_KEY, ANCHORAN_VERSION);
    useUpdateHistoryStore.setState({ history: nextHistory, hydrated: true });
  } else {
    useUpdateHistoryStore.setState({ history, hydrated: true });
  }
}
