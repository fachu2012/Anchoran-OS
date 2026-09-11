import { create } from "zustand";

export interface AnchoranNotification {
  id: string;
  title: string;
  message: string;
  createdAt: number;
}

interface NotificationState {
  notifications: AnchoranNotification[];
  push: (title: string, message: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

let counter = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  push: (title, message) => {
    counter += 1;
    const notification: AnchoranNotification = {
      id: `notif-${Date.now()}-${counter}`,
      title,
      message,
      createdAt: Date.now(),
    };
    set((s) => ({ notifications: [notification, ...s.notifications] }));
  },
  dismiss: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  clearAll: () => set({ notifications: [] }),
}));
