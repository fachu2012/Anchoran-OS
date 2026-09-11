import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import type { AppId } from "@/core/types";
import { APP_LIST } from "./registry";

const INSTALLED_KEY = "installedApps";

// Core apps (Files, Terminal, Settings, the Webstore itself) are always
// installed; the rest ship with a sensible day-one default so Anchoran
// is immediately usable, with the newest additions left for the user
// to discover and install from the Webstore.
const CORE_APP_IDS = APP_LIST.filter((a) => a.core).map((a) => a.id);
const DEFAULT_OPTIONAL_INSTALLED: AppId[] = ["notes", "calculator", "browser", "systemMonitor"];
const DEFAULT_INSTALLED: AppId[] = [...CORE_APP_IDS, ...DEFAULT_OPTIONAL_INSTALLED];

interface InstalledAppsState {
  installed: Set<AppId>;
  hydrated: boolean;
  isInstalled: (appId: AppId) => boolean;
  install: (appId: AppId) => void;
  uninstall: (appId: AppId) => void;
}

function persist(installed: Set<AppId>) {
  persistSet("config", INSTALLED_KEY, Array.from(installed));
}

export const useInstalledAppsStore = create<InstalledAppsState>((set, get) => ({
  installed: new Set(DEFAULT_INSTALLED),
  hydrated: false,

  isInstalled: (appId) => get().installed.has(appId),

  install: (appId) => {
    if (get().installed.has(appId)) return;
    const installed = new Set(get().installed).add(appId);
    set({ installed });
    persist(installed);
  },

  uninstall: (appId) => {
    if (CORE_APP_IDS.includes(appId)) return; // core apps can't be removed
    const installed = new Set(get().installed);
    installed.delete(appId);
    set({ installed });
    persist(installed);
  },
}));

persistGet<AppId[]>("config", INSTALLED_KEY, DEFAULT_INSTALLED).then((loaded) => {
  // Core apps are force-included even if an old persisted list predates
  // one of them (e.g. after an update adds a new core app).
  const installed = new Set([...loaded, ...CORE_APP_IDS]);
  useInstalledAppsStore.setState({ installed, hydrated: true });
});
