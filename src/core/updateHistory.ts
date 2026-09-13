import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import { ANCHORAN_VERSION } from "@/core/version";
import { BUILD_CHANNEL, type BuildChannel } from "@/core/buildChannel";

export interface UpdateHistoryEntry {
  fromVersion: string | null;
  /** Which channel the previous binary was — null only alongside a null fromVersion, i.e. no prior binary at all. */
  fromChannel: BuildChannel | null;
  toVersion: string;
  toChannel: BuildChannel;
  installedAt: number;
}

const HISTORY_KEY = "updateHistory";
const LAST_VERSION_KEY = "lastKnownVersion";
const LAST_CHANNEL_KEY = "lastKnownChannel";

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
 * updated — it just compares what it booted with last time (version
 * *and* build channel) to what it's booting with now, on every
 * startup. Whether the update happened via electron-updater, a manual
 * reinstall, or the fullscreen AnchoranSetup, it's detected the same
 * way. The channel check matters on its own: an Insider Preview build
 * and its later stable release of the same version share an identical
 * version number by design (see README's versioning section), so
 * version alone would miss that transition entirely — going from the
 * v3.0.0 I.P.U. build to the v3.0.0 stable release is a real, worth-
 * recording change even though ANCHORAN_VERSION never moves. Call
 * once, early in App startup.
 */
export async function recordUpdateIfVersionChanged(): Promise<void> {
  const [history, lastVersion, lastChannel] = await Promise.all([
    persistGet<UpdateHistoryEntry[]>("config", HISTORY_KEY, []),
    persistGet<string | null>("config", LAST_VERSION_KEY, null),
    persistGet<BuildChannel | null>("config", LAST_CHANNEL_KEY, null),
  ]);

  const isFirstLaunch = lastVersion === null;
  const changed = !isFirstLaunch && (lastVersion !== ANCHORAN_VERSION || lastChannel !== BUILD_CHANNEL);

  const nextHistory = changed
    ? [
        {
          fromVersion: lastVersion,
          fromChannel: lastChannel,
          toVersion: ANCHORAN_VERSION,
          toChannel: BUILD_CHANNEL,
          installedAt: Date.now(),
        },
        ...history,
      ].slice(0, 50)
    : history;

  if (changed || isFirstLaunch) {
    persistSet("config", HISTORY_KEY, nextHistory);
    persistSet("config", LAST_VERSION_KEY, ANCHORAN_VERSION);
    persistSet("config", LAST_CHANNEL_KEY, BUILD_CHANNEL);
  }
  useUpdateHistoryStore.setState({ history: nextHistory, hydrated: true });
}
