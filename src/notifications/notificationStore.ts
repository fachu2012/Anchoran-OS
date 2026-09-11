import { create } from "zustand";
import { playNotificationSound } from "@/core/sound";
import { persistGet, persistSet } from "@/core/persist";

export interface AnchoranNotification {
  id: string;
  title: string;
  message: string;
  createdAt: number;
  /** True for notifications pushed while Do Not Disturb was on — they were logged silently, no toast/sound. */
  silent: boolean;
}

const DND_KEY = "doNotDisturb";

interface NotificationState {
  notifications: AnchoranNotification[];
  doNotDisturb: boolean;
  push: (title: string, message: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  setDoNotDisturb: (on: boolean) => void;
}

let counter = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  doNotDisturb: false,
  push: (title, message) => {
    counter += 1;
    const dnd = get().doNotDisturb;
    const notification: AnchoranNotification = {
      id: `notif-${Date.now()}-${counter}`,
      title,
      message,
      createdAt: Date.now(),
      silent: dnd,
    };
    set((s) => ({ notifications: [notification, ...s.notifications] }));
    if (!dnd) playNotificationSound();
  },
  dismiss: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  clearAll: () => set({ notifications: [] }),
  setDoNotDisturb: (doNotDisturb) => {
    set({ doNotDisturb });
    persistSet("config", DND_KEY, doNotDisturb);
  },
}));

persistGet("config", DND_KEY, false).then((doNotDisturb) => {
  useNotificationStore.setState({ doNotDisturb });
});
