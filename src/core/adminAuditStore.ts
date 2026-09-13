import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";

export interface AdminAuditEntry {
  id: string;
  timestamp: number;
  /** Plain-language description of what happened — "Elevated Terminal as <name>", "Granted admin to <name>", … */
  action: string;
}

const KEY = "adminAuditLog";
const MAX_ENTRIES = 200;

interface AdminAuditState {
  entries: AdminAuditEntry[];
  record: (action: string) => void;
  clear: () => void;
}

/** A real audit trail of admin-level actions on this PC — who was elevated, and when admin status changed on any profile — visible to the owner in Settings → Users. */
export const useAdminAuditStore = create<AdminAuditState>((set, get) => ({
  entries: [],

  record: (action) => {
    const entries = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: Date.now(), action }, ...get().entries].slice(
      0,
      MAX_ENTRIES
    );
    set({ entries });
    persistSet("config", KEY, entries);
  },

  clear: () => {
    set({ entries: [] });
    persistSet("config", KEY, []);
  },
}));

persistGet<AdminAuditEntry[]>("config", KEY, []).then((entries) => {
  useAdminAuditStore.setState({ entries });
});
