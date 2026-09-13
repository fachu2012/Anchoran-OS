import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { persistGet, persistSet } from "@/core/persist";
import { useNotificationStore } from "@/notifications/notificationStore";
import { playNotificationSound } from "@/core/sound";
import "@/applications/apps.css";
import "./reminders.css";

type RepeatMode = "once" | "daily" | "weekdays";

const REPEAT_LABELS: Record<RepeatMode, string> = {
  once: "Once",
  daily: "Every day",
  weekdays: "Weekdays",
};

interface Reminder {
  id: string;
  title: string;
  time: string; // HH:MM, 24h
  enabled: boolean;
  firedToday: string | null; // YYYY-MM-DD, so it fires at most once/day
  repeat: RepeatMode;
}

function isDueToday(repeat: RepeatMode, now: Date): boolean {
  if (repeat === "weekdays") return now.getDay() >= 1 && now.getDay() <= 5;
  return true; // "once" and "daily" are both eligible any day — "once" is told apart by disabling itself after it fires, below.
}

const STORAGE_KEY = "reminders";

// Local calendar date, not UTC — the reminder time itself is compared
// in local hours/minutes below, so using toISOString() (UTC) here
// would desync "today" from local near midnight in timezones offset
// from UTC (e.g. Argentina, UTC-3), causing a reminder to fire twice
// or skip a day.
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RemindersApp() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [titleDraft, setTitleDraft] = useState("");
  const [timeDraft, setTimeDraft] = useState("09:00");
  const [repeatDraft, setRepeatDraft] = useState<RepeatMode>("daily");
  const pushNotification = useNotificationStore((s) => s.push);
  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;

  useEffect(() => {
    persistGet<Reminder[]>("data", STORAGE_KEY, []).then((loaded) => {
      // Reminders saved before "repeat" existed default to "daily" —
      // the exact behavior they already had.
      setReminders(loaded.map((r) => ({ ...r, repeat: r.repeat ?? "daily" })));
    });
  }, []);

  function save(next: Reminder[]) {
    setReminders(next);
    persistSet("data", STORAGE_KEY, next);
  }

  // Checks once a minute whether any enabled reminder matches the
  // current HH:MM and hasn't already fired today — real timers, not a
  // simulated "it would fire" placeholder.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const today = todayKey();
      let changed = false;
      const next = remindersRef.current.map((r) => {
        if (r.enabled && r.time === hhmm && r.firedToday !== today && isDueToday(r.repeat, now)) {
          pushNotification("Reminder", r.title);
          playNotificationSound();
          changed = true;
          // A one-time reminder turns itself off once it's fired —
          // "once" only ever means once, not "once, then daily forever".
          return { ...r, firedToday: today, enabled: r.repeat === "once" ? false : r.enabled };
        }
        return r;
      });
      if (changed) save(next);
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushNotification]);

  function addReminder() {
    const title = titleDraft.trim();
    if (!title) return;
    save([...reminders, { id: `${Date.now()}`, title, time: timeDraft, enabled: true, firedToday: null, repeat: repeatDraft }]);
    setTitleDraft("");
  }

  function toggle(id: string) {
    save(reminders.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }

  function remove(id: string) {
    save(reminders.filter((r) => r.id !== id));
  }

  const sorted = [...reminders].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <input
          className="todo-input"
          placeholder="Reminder title…"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addReminder()}
        />
        <input
          type="time"
          value={timeDraft}
          onChange={(e) => setTimeDraft(e.target.value)}
          className="reminders-time-input"
        />
        <select value={repeatDraft} onChange={(e) => setRepeatDraft(e.target.value as RepeatMode)} className="app-toolbar-btn">
          {(Object.keys(REPEAT_LABELS) as RepeatMode[]).map((r) => (
            <option key={r} value={r}>
              {REPEAT_LABELS[r]}
            </option>
          ))}
        </select>
        <button className="app-toolbar-btn" onClick={addReminder}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>
      <div className="app-content reminders-content">
        {sorted.length === 0 && (
          <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>No reminders set.</div>
        )}
        {sorted.map((r) => (
          <div key={r.id} className="reminders-row">
            <button className="todo-check" data-done={r.enabled} onClick={() => toggle(r.id)}>
              {r.enabled && <Icon name="check" size={12} />}
            </button>
            <span className="reminders-time">{r.time}</span>
            <span className="reminders-title" data-done={!r.enabled}>
              {r.title}
            </span>
            <span className="reminders-repeat">{REPEAT_LABELS[r.repeat]}</span>
            <button className="todo-remove" onClick={() => remove(r.id)} aria-label="Delete">
              <Icon name="close" size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
