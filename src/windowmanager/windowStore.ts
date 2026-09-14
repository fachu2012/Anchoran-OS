import { create } from "zustand";
import type { AppId } from "@/core/types";
import { APP_REGISTRY } from "@/applications/registry";
import { persistGet, persistSet } from "@/core/persist";
import { useProfilesStore } from "@/core/profilesStore";
import { useNotificationStore } from "@/notifications/notificationStore";
import { LEGACY_APP_ID_SET } from "@/core/legacyAppIds";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnchoranWindow {
  windowId: string;
  appId: AppId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  isMaximized: boolean;
  /** Bounds remembered from before maximizing, to restore into. */
  restoreBounds: Bounds | null;
  zIndex: number;
  /** A real file this window was opened to show — e.g. Files handing a file to its default app (Notes, Photo Viewer, Media Player, …). */
  openPath?: string;
  /** Terminal only: opened already-elevated via "Run as Administrator", after a successful admin PIN check. */
  startAdmin?: boolean;
  /** embeddedApp only: the real .exe this window reparents into itself — see EmbeddedApp.tsx. */
  embedPath?: string;
  /** pluginHost only: which downloaded third-party plugin this window mounts — see PluginHost.tsx and src/core/anchoranSDK.ts. */
  pluginId?: string;
  /** Keeps this window rendered above every non-pinned window regardless of focus order — a small utility window (Calculator, Clock) staying visible over a maximized one. */
  alwaysOnTop?: boolean;
  /** Which virtual desktop this window lives on — see desktops/activeDesktopId below. */
  desktopId: string;
}

export interface OpenAppOptions {
  openPath?: string;
  startAdmin?: boolean;
  embedPath?: string;
  pluginId?: string;
  /** Overrides the app's registry title for this one window — e.g. an embedded app is titled after its own exe, not the generic "Windows App Window". */
  title?: string;
}

type RememberedBoundsMap = Partial<Record<AppId, Bounds>>;

const REMEMBERED_BOUNDS_KEY = "windowBounds";
const SAVED_LAYOUTS_KEY = "windowLayouts";
const DESKTOPS_KEY = "virtualDesktops";
const DEFAULT_DESKTOP_ID = "1";

/** One window's shape within a named, saved layout — just enough to reopen it in the same place, not a full window snapshot (no file/content state). */
export interface SavedLayoutWindow {
  appId: AppId;
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

export type SavedLayoutsMap = Record<string, SavedLayoutWindow[]>;

interface WindowManagerState {
  windows: AnchoranWindow[];
  focusedWindowId: string | null;
  nextZIndex: number;
  rememberedBounds: RememberedBoundsMap;
  /** Live preview rect shown while dragging a window near a screen edge. */
  snapPreview: Bounds | null;
  /** Focus mode: dims/mutes every window except the focused one, for working without other windows pulling your eye. */
  focusMode: boolean;
  setFocusMode: (on: boolean) => void;

  /** Virtual desktops — each open window belongs to exactly one; only the active desktop's windows (and the taskbar entries for them) are shown. */
  desktops: string[];
  activeDesktopId: string;
  addDesktop: () => void;
  removeDesktop: (id: string) => void;
  switchDesktop: (id: string) => void;
  moveWindowToDesktop: (windowId: string, desktopId: string) => void;

  openApp: (appId: AppId, options?: OpenAppOptions) => string;
  closeWindow: (windowId: string) => void;
  /** Closes every open window at once — used by "Sign out" (see PowerMenu.tsx), which ends every profile's session without shutting Anchoran down. */
  closeAllWindows: () => void;
  focusWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  toggleMaximize: (windowId: string) => void;
  moveWindow: (windowId: string, x: number, y: number) => void;
  resizeWindow: (windowId: string, width: number, height: number) => void;
  setBounds: (windowId: string, bounds: Bounds) => void;
  setSnapPreview: (bounds: Bounds | null) => void;
  cycleFocus: (direction: 1 | -1) => void;
  /** Forgets every app's remembered window position/size — the next time each one opens, it starts at the default cascade spot again. */
  resetWindowLayout: () => void;
  toggleAlwaysOnTop: (windowId: string) => void;

  /** Named layouts you can save the current arrangement of open windows as, and jump back to later — opens (or moves, if already open) each app to the saved spot. */
  savedLayouts: SavedLayoutsMap;
  saveLayout: (name: string) => void;
  restoreLayout: (name: string) => void;
  deleteLayout: (name: string) => void;
}

let windowCounter = 0;
function createWindowId(appId: AppId): string {
  windowCounter += 1;
  return `${appId}-${windowCounter}-${Date.now()}`;
}

/** Simple cascade so new windows don't all stack in the exact same spot. */
function cascadeOffset(existingCount: number) {
  const step = 32;
  const max = 6;
  const n = existingCount % max;
  return { x: 120 + n * step, y: 90 + n * step };
}

function rememberBounds(appId: AppId, bounds: Bounds, current: RememberedBoundsMap) {
  const next = { ...current, [appId]: bounds };
  persistSet("config", REMEMBERED_BOUNDS_KEY, next);
  return next;
}

export const useWindowStore = create<WindowManagerState>((set, get) => ({
  windows: [],
  focusedWindowId: null,
  nextZIndex: 1,
  rememberedBounds: {},
  snapPreview: null,
  focusMode: false,
  setFocusMode: (on) => set({ focusMode: on }),

  desktops: [DEFAULT_DESKTOP_ID],
  activeDesktopId: DEFAULT_DESKTOP_ID,

  openApp: (appId, options) => {
    // The Terminal — plain or admin-elevated, there's no separate
    // "admin Terminal" app id, just a startAdmin flag on this same one
    // — is entirely off-limits to Guest. Guest can't set a PIN (see
    // profilesStore.ts / Settings' lockdown for it), so it could never
    // elevate anyway, but it shouldn't even reach a plain, unelevated
    // shell either.
    if (appId === "terminal" && useProfilesStore.getState().profiles.find((p) => p.id === useProfilesStore.getState().activeProfileId)?.isGuest) {
      useNotificationStore.getState().push("Terminal", "Not available for the Guest profile.");
      return "";
    }
    // Recycle Bin used to launch the real Windows one — now that
    // Anchoran has its own Trash (see Files.tsx), the desktop/taskbar/
    // Launcher icon opens straight into that instead, the same way any
    // other "open Files at a specific place" hand-off works.
    if (appId === "recycleBin") {
      return get().openApp("files", { openPath: "anchoran://trash" });
    }

    // On-Screen Keyboard and Narrator are things Windows already does
    // correctly, so Anchoran launches the genuine ones rather than
    // reimplementing them (see the matching IPC handlers in
    // electron/main.ts).
    const externalLaunch: Partial<Record<AppId, () => void>> = {
      onScreenKeyboard: () => window.anchoran?.openOsk(),
      narrator: () => window.anchoran?.openNarrator(),
    };
    if (externalLaunch[appId]) {
      externalLaunch[appId]!();
      return "";
    }

    const def = APP_REGISTRY[appId];
    // Last-resort guard: every known path that could hand openApp a
    // pre-migration app id (installedAppsStore, taskbarStore,
    // desktopIconsStore and saved layouts) already filters it out on
    // load — this only catches something those missed, so it fails
    // quietly instead of crashing WindowManager on an undefined
    // AppComponent.
    if (!def) {
      useNotificationStore.getState().push("Anchoran", "That app is no longer available — install its replacement from the Webstore.");
      return "";
    }
    const state = get();

    // Most apps are single-instance: focus the existing window instead
    // of opening a duplicate. If this open came with a specific file
    // (Files handing off to its default app), point the existing
    // window at that file too, rather than just focusing it as-is.
    if (!def.allowMultipleInstances) {
      const existing = state.windows.find((w) => w.appId === appId);
      if (existing) {
        // Jumping to an app already open on another virtual desktop
        // switches you there — the same "bring the desktop with it"
        // behavior a real OS has, rather than focusing a window you
        // can't actually see.
        if (existing.desktopId !== state.activeDesktopId) set({ activeDesktopId: existing.desktopId });
        get().focusWindow(existing.windowId);
        if (existing.isMinimized || options?.openPath) {
          set((s) => ({
            windows: s.windows.map((w) =>
              w.windowId === existing.windowId
                ? { ...w, isMinimized: false, openPath: options?.openPath ?? w.openPath }
                : w
            ),
          }));
        }
        return existing.windowId;
      }
    }

    const windowId = createWindowId(appId);
    const remembered = state.rememberedBounds[appId];
    const offset = cascadeOffset(state.windows.length);
    const zIndex = state.nextZIndex + 1;

    const newWindow: AnchoranWindow = {
      windowId,
      appId,
      title: options?.title ?? (options?.startAdmin ? `${def.title} (Administrator)` : def.title),
      x: remembered?.x ?? offset.x,
      y: remembered?.y ?? offset.y,
      width: Math.max(def.minSize?.width ?? 0, remembered?.width ?? def.defaultSize.width),
      height: Math.max(def.minSize?.height ?? 0, remembered?.height ?? def.defaultSize.height),
      isMinimized: false,
      isMaximized: false,
      restoreBounds: null,
      zIndex,
      openPath: options?.openPath,
      startAdmin: options?.startAdmin,
      embedPath: options?.embedPath,
      pluginId: options?.pluginId,
      desktopId: state.activeDesktopId,
    };

    set((s) => ({
      windows: [...s.windows, newWindow],
      focusedWindowId: windowId,
      nextZIndex: zIndex,
    }));

    return windowId;
  },

  closeWindow: (windowId) => {
    set((s) => {
      const closing = s.windows.find((w) => w.windowId === windowId);
      const windows = s.windows.filter((w) => w.windowId !== windowId);
      const focusedWindowId =
        s.focusedWindowId === windowId
          ? windows[windows.length - 1]?.windowId ?? null
          : s.focusedWindowId;
      const rememberedBounds =
        closing && !closing.isMaximized
          ? rememberBounds(
              closing.appId,
              { x: closing.x, y: closing.y, width: closing.width, height: closing.height },
              s.rememberedBounds
            )
          : s.rememberedBounds;
      return { windows, focusedWindowId, rememberedBounds };
    });
  },

  closeAllWindows: () => {
    set({ windows: [], focusedWindowId: null });
  },

  focusWindow: (windowId) => {
    set((s) => {
      const zIndex = s.nextZIndex + 1;
      return {
        windows: s.windows.map((w) => (w.windowId === windowId ? { ...w, zIndex } : w)),
        focusedWindowId: windowId,
        nextZIndex: zIndex,
      };
    });
  },

  minimizeWindow: (windowId) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.windowId === windowId ? { ...w, isMinimized: true } : w
      ),
      focusedWindowId: s.focusedWindowId === windowId ? null : s.focusedWindowId,
    }));
  },

  restoreWindow: (windowId) => {
    const zIndex = get().nextZIndex + 1;
    set((s) => ({
      windows: s.windows.map((w) =>
        w.windowId === windowId ? { ...w, isMinimized: false, zIndex } : w
      ),
      focusedWindowId: windowId,
      nextZIndex: zIndex,
    }));
  },

  toggleMaximize: (windowId) => {
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.windowId !== windowId) return w;
        if (w.isMaximized) {
          const bounds = w.restoreBounds ?? { x: 120, y: 90, width: w.width, height: w.height };
          return { ...w, isMaximized: false, ...bounds, restoreBounds: null };
        }
        return {
          ...w,
          isMaximized: true,
          restoreBounds: { x: w.x, y: w.y, width: w.width, height: w.height },
        };
      }),
    }));
  },

  moveWindow: (windowId, x, y) => {
    set((s) => ({
      windows: s.windows.map((w) => (w.windowId === windowId ? { ...w, x, y } : w)),
    }));
  },

  resizeWindow: (windowId, width, height) => {
    set((s) => ({
      windows: s.windows.map((w) => (w.windowId === windowId ? { ...w, width, height } : w)),
    }));
  },

  setBounds: (windowId, bounds) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.windowId === windowId ? { ...w, ...bounds, isMaximized: false, restoreBounds: null } : w
      ),
    }));
  },

  setSnapPreview: (bounds) => set({ snapPreview: bounds }),

  /**
   * Cycles focus between open, non-minimized windows — Anchoran's
   * window switcher, bound to Ctrl+Tab / Ctrl+Shift+Tab (see
   * Desktop.tsx). This is deliberately not literal Alt+Tab: Windows
   * itself owns that combination at the shell level the same way it
   * owns the bare Windows key, so a normal Electron app can't reliably
   * intercept it — see the Windows-key note in electron/main.ts.
   */
  cycleFocus: (direction) => {
    const s = get();
    const candidates = s.windows.filter((w) => !w.isMinimized);
    if (candidates.length < 2) return;
    const currentIndex = candidates.findIndex((w) => w.windowId === s.focusedWindowId);
    const nextIndex = (currentIndex + direction + candidates.length) % candidates.length;
    get().focusWindow(candidates[nextIndex].windowId);
  },

  resetWindowLayout: () => {
    set({ rememberedBounds: {} });
    persistSet("config", REMEMBERED_BOUNDS_KEY, {});
  },

  toggleAlwaysOnTop: (windowId) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.windowId === windowId ? { ...w, alwaysOnTop: !w.alwaysOnTop } : w
      ),
    }));
  },

  savedLayouts: {},

  saveLayout: (name) => {
    const snapshot: SavedLayoutWindow[] = get().windows.map((w) => ({
      appId: w.appId,
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
      isMaximized: w.isMaximized,
    }));
    const savedLayouts = { ...get().savedLayouts, [name]: snapshot };
    set({ savedLayouts });
    persistSet("config", SAVED_LAYOUTS_KEY, savedLayouts);
  },

  restoreLayout: (name) => {
    const layout = get().savedLayouts[name];
    if (!layout) return;
    for (const saved of layout) {
      const existing = get().windows.find((w) => w.appId === saved.appId);
      if (existing) {
        get().setBounds(existing.windowId, { x: saved.x, y: saved.y, width: saved.width, height: saved.height });
        if (saved.isMaximized) get().toggleMaximize(existing.windowId);
      } else {
        const windowId = get().openApp(saved.appId);
        if (windowId) {
          get().setBounds(windowId, { x: saved.x, y: saved.y, width: saved.width, height: saved.height });
          if (saved.isMaximized) get().toggleMaximize(windowId);
        }
      }
    }
  },

  deleteLayout: (name) => {
    const savedLayouts = { ...get().savedLayouts };
    delete savedLayouts[name];
    set({ savedLayouts });
    persistSet("config", SAVED_LAYOUTS_KEY, savedLayouts);
  },

  addDesktop: () => {
    const s = get();
    let n = s.desktops.length + 1;
    while (s.desktops.includes(String(n))) n++;
    const id = String(n);
    const desktops = [...s.desktops, id];
    set({ desktops, activeDesktopId: id });
    persistSet("config", DESKTOPS_KEY, desktops);
  },

  removeDesktop: (id) => {
    const s = get();
    if (s.desktops.length <= 1) return;
    const desktops = s.desktops.filter((d) => d !== id);
    const fallback = desktops[0];
    // Windows left on a removed desktop move to the desktop before it
    // in the list (or the first one) rather than vanishing.
    const windows = s.windows.map((w) => (w.desktopId === id ? { ...w, desktopId: fallback } : w));
    const activeDesktopId = s.activeDesktopId === id ? fallback : s.activeDesktopId;
    set({ desktops, windows, activeDesktopId });
    persistSet("config", DESKTOPS_KEY, desktops);
  },

  switchDesktop: (id) => {
    if (!get().desktops.includes(id)) return;
    set({ activeDesktopId: id });
  },

  moveWindowToDesktop: (windowId, desktopId) => {
    set((s) => ({
      windows: s.windows.map((w) => (w.windowId === windowId ? { ...w, desktopId } : w)),
    }));
  },
}));

persistGet<SavedLayoutsMap>("config", SAVED_LAYOUTS_KEY, {}).then((loaded) => {
  // A saved layout from before the Anchoran App SDK migration can
  // still name a now-removed app id in one of its windows — dropped
  // here (per-layout, not the whole layout) so restoring an old
  // layout never tries to open an app APP_COMPONENTS has no entry for.
  let changed = false;
  const savedLayouts: SavedLayoutsMap = {};
  for (const [name, windows] of Object.entries(loaded)) {
    const filtered = windows.filter((w) => !LEGACY_APP_ID_SET.has(w.appId));
    if (filtered.length !== windows.length) changed = true;
    savedLayouts[name] = filtered;
  }
  useWindowStore.setState({ savedLayouts });
  if (changed) persistSet("config", SAVED_LAYOUTS_KEY, savedLayouts);
});

persistGet<string[]>("config", DESKTOPS_KEY, [DEFAULT_DESKTOP_ID]).then((desktops) => {
  if (desktops.length > 0) useWindowStore.setState({ desktops });
});

persistGet<RememberedBoundsMap>("config", REMEMBERED_BOUNDS_KEY, {}).then((loaded) => {
  useWindowStore.setState({ rememberedBounds: loaded });
});
