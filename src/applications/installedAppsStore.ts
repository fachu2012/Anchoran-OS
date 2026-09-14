import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import type { AppId } from "@/core/types";
import { APP_LIST } from "./registry";
import { useTaskbarStore } from "@/desktop/taskbarStore";
import { useDesktopIconsStore } from "@/desktop/desktopIconsStore";
import { LEGACY_APP_ID_SET } from "@/core/legacyAppIds";

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
  "browser",
  "systemMonitor",
  "networkMonitor",
  "eventViewer",
  "mediaPlayer",
  "photoViewer",
  "recycleBin",
  "storageUsage",
  "startupApps",
  "onScreenKeyboard",
  "narrator",
];
const DEFAULT_INSTALLED: AppId[] = [...CORE_APP_IDS, ...DEFAULT_OPTIONAL_INSTALLED];

// Every app installed by default — core or not — is protected from
// uninstall. Only apps the user chose to install from the Webstore
// themselves can be removed again.
const PROTECTED_APP_IDS = new Set<AppId>(DEFAULT_INSTALLED);

/** Whether an app is installed by default — for UI (e.g. requiring a PIN before the Uninstall button does anything). */
export function isProtectedApp(appId: AppId): boolean {
  return PROTECTED_APP_IDS.has(appId);
}

/** The genuine "this would brick the desktop shell" apps — Files, Terminal, Settings, the Webstore. These can never be uninstalled, PIN or not. */
export function isCoreApp(appId: AppId): boolean {
  return CORE_APP_IDS.includes(appId);
}

interface InstalledAppsState {
  installed: Set<AppId>;
  hydrated: boolean;
  isInstalled: (appId: AppId) => boolean;
  install: (appId: AppId) => void;
  /** Pass `force: true` (only after a real admin PIN check — see AdminPinPrompt) to remove a default-installed-but-not-core app. Core apps never uninstall, forced or not. */
  uninstall: (appId: AppId, options?: { force?: boolean }) => void;
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

  uninstall: (appId, options) => {
    if (CORE_APP_IDS.includes(appId)) return; // never removable, PIN or not
    if (PROTECTED_APP_IDS.has(appId) && !options?.force) return; // default-installed, non-core apps need a PIN-confirmed forced uninstall
    const installed = new Set(get().installed);
    installed.delete(appId);
    set({ installed });
    persist(installed);
    // An uninstalled app can't stay pinned anywhere it was shortcut to —
    // wherever uninstall is triggered from (the Launcher, the Webstore,
    // or anywhere else), it always unpins the app from the taskbar and
    // removes it from the desktop too.
    useTaskbarStore.getState().unpin(appId);
    useDesktopIconsStore.getState().unpinApp(appId);
  },
}));

persistGet<AppId[]>("config", INSTALLED_KEY, DEFAULT_INSTALLED).then((loaded) => {
  // Every protected (default-installed) app is force-included even if
  // an old persisted list predates it — e.g. after an update adds a
  // new core app, or promotes a Webstore app to installed-by-default.
  //
  // A persisted list from before the Anchoran App SDK migration (see
  // CHANGELOG) can still contain one of the old bundled-app ids that
  // migration removed (Snake, Chess, Chat, …) — those apps no longer
  // exist in APP_COMPONENTS at all, so keeping such an id "installed"
  // here would crash WindowManager the moment something tried to open
  // it (a pinned taskbar icon, a saved window layout, Launcher search).
  // Anyone who had one installed already saw the "Anchoran Local Apps"
  // notice on their way into this update (see UpdateReadyScreen /
  // upgradeAppRemoval.ts) — this is where that removal actually lands.
  const hadLegacyApps = loaded.some((id) => LEGACY_APP_ID_SET.has(id));
  const installed = new Set([...loaded.filter((id) => !LEGACY_APP_ID_SET.has(id)), ...PROTECTED_APP_IDS]);
  useInstalledAppsStore.setState({ installed, hydrated: true });
  if (hadLegacyApps) persist(installed);
});
