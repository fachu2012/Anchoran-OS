import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import type { AppId } from "@/core/types";
import { APP_LIST } from "./registry";

const INSTALLED_KEY = "installedApps";

// Core apps (Files, Terminal, Settings, the Webstore itself) are always
// installed; the rest ship with a sensible day-one default so Anchoran
// is immediately usable, with the newest additions left for the user
// to discover and install from the Webstore. System-category tools
// (Network Monitor, Event Viewer, …), a couple of everyday utility
// apps (Media Player, Magnifier), and every app that actually opens a
// specific real file type from disk (Notes → text, Media Player →
// audio/video, Photo Viewer → images, Zip Tool → .zip) ship installed
// by default too — the same way a real OS's own built-in file
// handlers aren't something you'd expect to have to go find in a
// store first.
const CORE_APP_IDS = APP_LIST.filter((a) => a.core).map((a) => a.id);
const DEFAULT_OPTIONAL_INSTALLED: AppId[] = [
  "notes",
  "calculator",
  "browser",
  "systemMonitor",
  "networkMonitor",
  "eventViewer",
  "mediaPlayer",
  "magnifier",
  "photoViewer",
  "zipTool",
  "screenshot",
  "recycleBin",
  "storageUsage",
  "startupApps",
  "onScreenKeyboard",
  "narrator",
  "emojiPicker",
];
const DEFAULT_INSTALLED: AppId[] = [...CORE_APP_IDS, ...DEFAULT_OPTIONAL_INSTALLED];

// Every app installed by default — core or not — is protected from
// uninstall. Only apps the user chose to install from the Webstore
// themselves can be removed again.
const PROTECTED_APP_IDS = new Set<AppId>(DEFAULT_INSTALLED);

/** Whether an app is installed by default and therefore can't be uninstalled — for UI (e.g. hiding the Uninstall button). */
export function isProtectedApp(appId: AppId): boolean {
  return PROTECTED_APP_IDS.has(appId);
}

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
    if (PROTECTED_APP_IDS.has(appId)) return; // default-installed apps can't be removed
    const installed = new Set(get().installed);
    installed.delete(appId);
    set({ installed });
    persist(installed);
  },
}));

persistGet<AppId[]>("config", INSTALLED_KEY, DEFAULT_INSTALLED).then((loaded) => {
  // Every protected (default-installed) app is force-included even if
  // an old persisted list predates it — e.g. after an update adds a
  // new core app, or promotes a Webstore app to installed-by-default.
  const installed = new Set([...loaded, ...PROTECTED_APP_IDS]);
  useInstalledAppsStore.setState({ installed, hydrated: true });
});
