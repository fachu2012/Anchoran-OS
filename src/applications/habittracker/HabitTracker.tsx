import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { persistGet, persistSet } from "@/core/persist";
import "@/applications/apps.css";
import "./habittracker.css";

interface Habit {
  id: string;
  name: string;
  /** YYYY-MM-DD dates the habit was marked done. */
  doneDates: string[];
}

const STORAGE_KEY = "habits";
const DAYS_SHOWN = 14;

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number) {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(dateKey(d));
  }
  return days;
}

function currentStreak(doneDates: string[]) {
  const set = new Set(doneDates);
  let streak = 0;
  const cursor = new Date();
  while (set.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function HabitTrackerApp() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [draft, setDraft] = useState("");
  const days = lastNDays(DAYS_SHOWN);

  useEffect(() => {
    persistGet<Habit[]>("data", STORAGE_KEY, []).then(setHabits);
  }, []);

  function save(next: Habit[]) {
    setHabits(next);
    persistSet("data", STORAGE_KEY, next);
  }

  function addHabit() {
    const name = draft.trim();
    if (!name) return;
    save([...habits, { id: `${Date.now()}`, name, doneDates: [] }]);
    setDraft("");
  }

  function toggleDay(habitId: string, day: string) {
    save(
      habits.map((h) =>
        h.id === habitId
          ? { ...h, doneDates: h.doneDates.includes(day) ? h.doneDates.filter((d) => d !== day) : [...h.doneDates, day] }
          : h
      )
    );
  }

  function removeHabit(id: string) {
    save(habits.filter((h) => h.id !== id));
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <input
          className="todo-input"
          placeholder="New habit…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addHabit()}
        />
        <button className="app-toolbar-btn" onClick={addHabit}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>
      <div className="app-content habit-content">
        {habits.length === 0 && (
          <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>No habits yet.</div>
        )}
        {habits.map((h) => (
          <div key={h.id} className="habit-row">
            <div className="habit-header">
              <span className="habit-name">{h.name}</span>
              <span className="habit-streak">{currentStreak(h.doneDates)} day streak</span>
              <button className="todo-remove" onClick={() => removeHabit(h.id)} aria-label="Delete">
                <Icon name="close" size={12} />
              </button>
            </div>
            <div className="habit-days">
              {days.map((day) => (
                <button
                  key={day}
                  className="habit-day"
                  data-done={h.doneDates.includes(day)}
                  title={day}
                  onClick={() => toggleDay(h.id, day)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
