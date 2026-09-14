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
// is immediately usable. As of the Anchoran App SDK migration, every
// bundled app ships this way — none of them are actually "from" the
// Webstore (see AppCenter.tsx, which no longer even browses this
// list), so there's nothing left to "discover and install" among
// them. System-category tools (Network Monitor, Event Viewer, …), a
// couple of everyday utility apps (Media Player, Magnifier, the
// experimental Windows App Window embed), and every app that actually
// opens a specific real file type from disk (Notes → text, Media
// Player → audio/video, Photo Viewer → images, Zip Tool → .zip) ship
// installed by default too — the same way a real OS's own built-in
// file handlers aren't something you'd expect to have to go find in a
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
  "embeddedApp",
];
const DEFAULT_INSTALLED: AppId[] = [...CORE_APP_IDS, ...DEFAULT_OPTIONAL_INSTALLED];

// Every app installed by default — core or not — is genuinely
// permanent: no PIN, no admin override, nothing uninstalls it. These
// are exactly the apps a real OS never lets you remove either (a file
// explorer, the system monitor, the recycle bin, the default photo/
// media viewer a real file type is wired to) — not because Anchoran
// enforces some arbitrary policy, but because removing one would
// leave the desktop in a state that doesn't make sense to use, the
// same reasoning Windows itself applies to File Explorer or the
// Recycle Bin. Only apps the user chose to install from the Webstore
// themselves can ever be removed again.
const PROTECTED_APP_IDS = new Set<AppId>(DEFAULT_INSTALLED);

/** Whether an app is installed by default and can never be uninstalled — see PROTECTED_APP_IDS. Used for UI (hiding the Uninstall action entirely, not just gating it behind a PIN). */
export function isProtectedApp(appId: AppId): boolean {
  return PROTECTED_APP_IDS.has(appId);
}

/** The genuine "this would brick the desktop shell" apps — Files, Terminal, Settings, the Webstore. Same permanence as every other isProtectedApp() app now, kept as its own check for places that specifically mean "the shell itself" rather than "installed by default". */
export function isCoreApp(appId: AppId): boolean {
  return CORE_APP_IDS.includes(appId);
}

interface InstalledAppsState {
  installed: Set<AppId>;
  hydrated: boolean;
  isInstalled: (appId: AppId) => boolean;
  install: (appId: AppId) => void;
  /** No PIN, no admin override, no exceptions — see PROTECTED_APP_IDS. Only ever removes an app the user installed themselves from the Webstore. */
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
    if (PROTECTED_APP_IDS.has(appId)) return; // covers CORE_APP_IDS too — never removable, no exceptions
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
