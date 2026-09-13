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
const DND_SCHEDULE_KEY = "doNotDisturbSchedule";

/** "HH:MM" 24h — the schedule wraps past midnight when end <= start (e.g. 22:00 → 07:00). */
export interface DndSchedule {
  enabled: boolean;
  start: string;
  end: string;
}

const DEFAULT_SCHEDULE: DndSchedule = { enabled: false, start: "22:00", end: "07:00" };

function isWithinSchedule(schedule: DndSchedule, now = new Date()): boolean {
  if (!schedule.enabled) return false;
  const [startH, startM] = schedule.start.split(":").map(Number);
  const [endH, endM] = schedule.end.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (startMin === endMin) return false;
  return startMin < endMin ? nowMin >= startMin && nowMin < endMin : nowMin >= startMin || nowMin < endMin;
}

interface NotificationState {
  notifications: AnchoranNotification[];
  doNotDisturb: boolean;
  dndSchedule: DndSchedule;
  push: (title: string, message: string) => void;
  dismiss: (id: string) => void;
  /** Dismisses a notification now and re-delivers the same title/message after the given number of minutes. */
  snooze: (id: string, minutes: number) => void;
  clearAll: () => void;
  setDoNotDisturb: (on: boolean) => void;
  setDndSchedule: (schedule: Partial<DndSchedule>) => void;
}

let counter = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  doNotDisturb: false,
  dndSchedule: DEFAULT_SCHEDULE,
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
  snooze: (id, minutes) => {
    const target = get().notifications.find((n) => n.id === id);
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
    if (!target) return;
    setTimeout(() => get().push(target.title, target.message), minutes * 60000);
  },
  clearAll: () => set({ notifications: [] }),
  setDoNotDisturb: (doNotDisturb) => {
    set({ doNotDisturb });
    persistSet("config", DND_KEY, doNotDisturb);
  },
  setDndSchedule: (partial) => {
    const dndSchedule = { ...get().dndSchedule, ...partial };
    set({ dndSchedule });
    persistSet("config", DND_SCHEDULE_KEY, dndSchedule);
  },
}));

persistGet("config", DND_KEY, false).then((doNotDisturb) => {
  useNotificationStore.setState({ doNotDisturb });
});

persistGet<DndSchedule>("config", DND_SCHEDULE_KEY, DEFAULT_SCHEDULE).then((dndSchedule) => {
  useNotificationStore.setState({ dndSchedule });
});

// Applies the schedule once a minute — only actually flips
// doNotDisturb when the scheduled state disagrees with the current
// one, so a manual toggle mid-window isn't fought every tick, just
// re-asserted at the next real boundary crossing (the same trade-off
// a real OS's own scheduled focus mode makes).
setInterval(() => {
  const { dndSchedule, doNotDisturb } = useNotificationStore.getState();
  if (!dndSchedule.enabled) return;
  const shouldBeOn = isWithinSchedule(dndSchedule);
  if (shouldBeOn !== doNotDisturb) {
    useNotificationStore.setState({ doNotDisturb: shouldBeOn });
    persistSet("config", DND_KEY, shouldBeOn);
  }
}, 60000);
