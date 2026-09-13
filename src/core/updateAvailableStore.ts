import { create } from "zustand";

export type UpdateLifecycle = "none" | "available" | "downloading" | "downloaded";

interface UpdateAvailableState {
  status: UpdateLifecycle;
  version: string | null;
  set: (status: UpdateLifecycle, version?: string) => void;
}

/** A persistent "an update exists" flag, fed by the same onUpdateStatus events Terminal/Settings already print — see Taskbar.tsx for where it actually shows up. Intentionally not persisted to disk: it reflects the live updater's current state, not something to remember across restarts. */
export const useUpdateAvailableStore = create<UpdateAvailableState>((set) => ({
  status: "none",
  version: null,
  set: (status, version) => set({ status, version: version ?? null }),
}));
