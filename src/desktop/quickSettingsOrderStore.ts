import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";

export const DEFAULT_QUICK_SETTINGS_ORDER = ["focus", "nightLight", "powerProfile", "windowSpotlight"] as const;
export type QuickSettingRowKey = (typeof DEFAULT_QUICK_SETTINGS_ORDER)[number];

const KEY = "quickSettingsOrder";

interface QuickSettingsOrderState {
  order: QuickSettingRowKey[];
  reorder: (fromIndex: number, toIndex: number) => void;
}

/** Drag-to-reorder for the Quick Settings toggle rows (Focus, Night Light, Power profile, Window Spotlight) — same reordering idea as the taskbar's own pinned apps. */
export const useQuickSettingsOrderStore = create<QuickSettingsOrderState>((set, get) => ({
  order: [...DEFAULT_QUICK_SETTINGS_ORDER],
  reorder: (fromIndex, toIndex) => {
    const order = [...get().order];
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    set({ order });
    persistSet("config", KEY, order);
  },
}));

persistGet<QuickSettingRowKey[]>("config", KEY, [...DEFAULT_QUICK_SETTINGS_ORDER]).then((order) => {
  // Guards against a stale persisted list missing a row a later
  // version added (or naming one that no longer exists).
  const valid = order.filter((k): k is QuickSettingRowKey => (DEFAULT_QUICK_SETTINGS_ORDER as readonly string[]).includes(k));
  const missing = DEFAULT_QUICK_SETTINGS_ORDER.filter((k) => !valid.includes(k));
  useQuickSettingsOrderStore.setState({ order: [...valid, ...missing] });
});
