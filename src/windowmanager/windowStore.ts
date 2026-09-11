import { create } from "zustand";
import type { AppId } from "@/core/types";
import { APP_REGISTRY } from "@/applications/registry";

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
  restoreBounds: { x: number; y: number; width: number; height: number } | null;
  zIndex: number;
}

interface WindowManagerState {
  windows: AnchoranWindow[];
  focusedWindowId: string | null;
  nextZIndex: number;

  openApp: (appId: AppId) => string;
  closeWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  toggleMaximize: (windowId: string) => void;
  moveWindow: (windowId: string, x: number, y: number) => void;
  resizeWindow: (windowId: string, width: number, height: number) => void;
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

export const useWindowStore = create<WindowManagerState>((set, get) => ({
  windows: [],
  focusedWindowId: null,
  nextZIndex: 1,

  openApp: (appId) => {
    const def = APP_REGISTRY[appId];
    const state = get();

    // Most apps are single-instance: focus the existing window instead
    // of opening a duplicate.
    if (!def.allowMultipleInstances) {
      const existing = state.windows.find((w) => w.appId === appId);
      if (existing) {
        get().focusWindow(existing.windowId);
        if (existing.isMinimized) {
          set((s) => ({
            windows: s.windows.map((w) =>
              w.windowId === existing.windowId ? { ...w, isMinimized: false } : w
            ),
          }));
        }
        return existing.windowId;
      }
    }

    const windowId = createWindowId(appId);
    const offset = cascadeOffset(state.windows.length);
    const zIndex = state.nextZIndex + 1;

    const newWindow: AnchoranWindow = {
      windowId,
      appId,
      title: def.title,
      x: offset.x,
      y: offset.y,
      width: def.defaultSize.width,
      height: def.defaultSize.height,
      isMinimized: false,
      isMaximized: false,
      restoreBounds: null,
      zIndex,
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
      const windows = s.windows.filter((w) => w.windowId !== windowId);
      const focusedWindowId =
        s.focusedWindowId === windowId
          ? windows[windows.length - 1]?.windowId ?? null
          : s.focusedWindowId;
      return { windows, focusedWindowId };
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
}));
