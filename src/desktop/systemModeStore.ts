import { create } from "zustand";

/**
 * System Mode: deliberately NOT persisted. Every fresh launch of
 * Anchoran starts with this off, and the user has to consciously turn
 * it on again each session — see TODO.md for the full reasoning. This
 * store just mirrors the main process's real state (electron/main.ts)
 * and exposes start/stop.
 */
interface SystemModeState {
  running: boolean;
  supported: boolean;
  starting: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export const useSystemModeStore = create<SystemModeState>((set, get) => ({
  running: false,
  supported: false,
  starting: false,
  error: null,

  refreshStatus: async () => {
    if (!window.anchoran) return;
    const status = await window.anchoran.systemModeStatus();
    set({ running: status.running, supported: status.supported });
  },

  start: async () => {
    if (!window.anchoran || get().starting) return;
    set({ starting: true, error: null });
    const result = await window.anchoran.systemModeStart();
    set({ starting: false, running: result.success, error: result.success ? null : result.error ?? "Couldn't start." });
  },

  stop: async () => {
    if (!window.anchoran) return;
    await window.anchoran.systemModeStop();
    set({ running: false });
  },
}));

if (typeof window !== "undefined" && window.anchoran) {
  window.anchoran.onSystemModeStatusChange((running) => {
    useSystemModeStore.setState({ running });
  });
}
