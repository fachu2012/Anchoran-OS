import { create } from "zustand";
import type { AppId } from "@/core/types";
import { APP_REGISTRY } from "@/applications/registry";
import { persistGet, persistSet } from "@/core/persist";

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
}

export interface OpenAppOptions {
  openPath?: string;
  startAdmin?: boolean;
}

type RememberedBoundsMap = Partial<Record<AppId, Bounds>>;

const REMEMBERED_BOUNDS_KEY = "windowBounds";

interface WindowManagerState {
  windows: AnchoranWindow[];
  focusedWindowId: string | null;
  nextZIndex: number;
  rememberedBounds: RememberedBoundsMap;
  /** Live preview rect shown while dragging a window near a screen edge. */
  snapPreview: Bounds | null;

  openApp: (appId: AppId, options?: OpenAppOptions) => string;
  closeWindow: (windowId: string) => void;
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

  openApp: (appId, options) => {
    // Some "apps" launch a real external Windows tool instead of
    // opening an Anchoran window — Recycle Bin, On-Screen Keyboard and
    // Narrator are all things Windows already does correctly, so
    // Anchoran launches the genuine ones rather than reimplementing
    // them (see the matching IPC handlers in electron/main.ts).
    const externalLaunch: Partial<Record<AppId, () => void>> = {
      recycleBin: () => window.anchoran?.openRecycleBin(),
      onScreenKeyboard: () => window.anchoran?.openOsk(),
      narrator: () => window.anchoran?.openNarrator(),
    };
    if (externalLaunch[appId]) {
      externalLaunch[appId]!();
      return "";
    }

    const def = APP_REGISTRY[appId];
    const state = get();

    // Most apps are single-instance: focus the existing window instead
    // of opening a duplicate. If this open came with a specific file
    // (Files handing off to its default app), point the existing
    // window at that file too, rather than just focusing it as-is.
    if (!def.allowMultipleInstances) {
      const existing = state.windows.find((w) => w.appId === appId);
      if (existing) {
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
      title: options?.startAdmin ? `${def.title} (Administrator)` : def.title,
      x: remembered?.x ?? offset.x,
      y: remembered?.y ?? offset.y,
      width: remembered?.width ?? def.defaultSize.width,
      height: remembered?.height ?? def.defaultSize.height,
      isMinimized: false,
      isMaximized: false,
      restoreBounds: null,
      zIndex,
      openPath: options?.openPath,
      startAdmin: options?.startAdmin,
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
}));

persistGet<RememberedBoundsMap>("config", REMEMBERED_BOUNDS_KEY, {}).then((loaded) => {
  useWindowStore.setState({ rememberedBounds: loaded });
});
