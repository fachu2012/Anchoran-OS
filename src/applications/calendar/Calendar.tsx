import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { persistGet, persistSet } from "@/core/persist";
import "@/applications/apps.css";
import "./calendar.css";

interface CalEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
}

const STORAGE_KEY = "calendarEvents";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function todayKey() {
  const t = new Date();
  return toKey(t.getFullYear(), t.getMonth(), t.getDate());
}

export function CalendarApp() {
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() };
  });
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [draft, setDraft] = useState("");

  useEffect(() => {
    persistGet<CalEvent[]>("data", STORAGE_KEY, []).then(setEvents);
  }, []);

  function save(next: CalEvent[]) {
    setEvents(next);
    persistSet("data", STORAGE_KEY, next);
  }

  function addEvent() {
    const title = draft.trim();
    if (!title) return;
    save([...events, { id: `${Date.now()}`, date: selectedDate, title }]);
    setDraft("");
  }

  function removeEvent(id: string) {
    save(events.filter((e) => e.id !== id));
  }

  const cells = useMemo(() => {
    const { year, month } = cursor;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: { key: string; day: number | null }[] = [];
    for (let i = 0; i < firstDay; i++) list.push({ key: `pad-${i}`, day: null });
    for (let d = 1; d <= daysInMonth; d++) list.push({ key: toKey(year, month, d), day: d });
    return list;
  }, [cursor]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [events]);

  const selectedEvents = eventsByDate.get(selectedDate) ?? [];

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button
          className="app-toolbar-btn"
          onClick={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))}
        >
          <Icon name="chevronRight" size={13} style={{ transform: "rotate(180deg)" }} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 500, minWidth: 130, textAlign: "center" }}>
          {MONTHS[cursor.month]} {cursor.year}
        </span>
        <button
          className="app-toolbar-btn"
          onClick={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))}
        >
          <Icon name="chevronRight" size={13} />
        </button>
        <button
          className="app-toolbar-btn"
          onClick={() => {
            const t = new Date();
            setCursor({ year: t.getFullYear(), month: t.getMonth() });
            setSelectedDate(todayKey());
          }}
          style={{ marginLeft: "auto" }}
        >
          Today
        </button>
      </div>
      <div className="app-content calendar-content">
        <div className="calendar-grid">
          {WEEKDAYS.map((w) => (
            <div key={w} className="calendar-weekday">
              {w}
            </div>
          ))}
          {cells.map((c) => (
            <button
              key={c.key}
              className="calendar-cell"
              disabled={c.day === null}
              data-today={c.key === todayKey()}
              data-selected={c.key === selectedDate}
              data-has-events={eventsByDate.has(c.key)}
              onClick={() => c.day !== null && setSelectedDate(c.key)}
            >
              {c.day}
              {eventsByDate.has(c.key) && <span className="calendar-dot" />}
            </button>
          ))}
        </div>
        <div className="calendar-side">
          <div className="calendar-side-title">{selectedDate}</div>
          <div className="calendar-events">
            {selectedEvents.length === 0 && (
              <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>No events.</div>
            )}
            {selectedEvents.map((e) => (
              <div key={e.id} className="calendar-event-row">
                <span>{e.title}</span>
                <button className="todo-remove" onClick={() => removeEvent(e.id)} aria-label="Delete">
                  <Icon name="close" size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="calendar-add">
            <input
              placeholder="Add event…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEvent()}
            />
            <button className="app-toolbar-btn" onClick={addEvent}>
              <Icon name="plus" size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
