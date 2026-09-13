import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import type { NotificationSoundVariant } from "@/core/sound";

const KEY = "notificationSoundByApp";

interface NotificationSoundState {
  byApp: Record<string, NotificationSoundVariant>;
  setSound: (appTitle: string, variant: NotificationSoundVariant) => void;
  soundFor: (appTitle: string) => NotificationSoundVariant;
}

/** Which notification tone plays per app/source — "Files", "Anchoran Webstore", etc. (the same string notificationStore.push()'s `title` carries). Anything not explicitly set here plays the default tone. */
export const useNotificationSoundStore = create<NotificationSoundState>((set, get) => ({
  byApp: {},
  setSound: (appTitle, variant) => {
    const byApp = { ...get().byApp, [appTitle]: variant };
    set({ byApp });
    persistSet("config", KEY, byApp);
  },
  soundFor: (appTitle) => get().byApp[appTitle] ?? "default",
}));

persistGet<Record<string, NotificationSoundVariant>>("config", KEY, {}).then((byApp) => {
  useNotificationSoundStore.setState({ byApp });
});
