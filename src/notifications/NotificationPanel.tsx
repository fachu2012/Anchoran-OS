import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useNotificationStore, type AnchoranNotification } from "./notificationStore";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** The full current time, seconds included — the taskbar clock itself only ticks by the minute, so this panel (opened from that same clock) is where a precise read is actually available, same as a real OS's own clock flyout. */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div style={{ padding: "2px 6px 8px", fontSize: 22, fontWeight: 300, fontVariantNumeric: "tabular-nums" }}>
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </div>
  );
}

/** A compact, read-only month calendar — the same "what's today, what's coming up this week" glance a real OS's own notification center gives you above the notifications themselves. */
function MiniCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div style={{ padding: "6px 6px 10px", borderBottom: "1px solid var(--anchoran-border)" }}>
      <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 6 }}>
        {today.toLocaleDateString([], { month: "long", year: "numeric" })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, fontSize: 10.5, color: "var(--anchoran-text-secondary)", marginBottom: 2 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              fontSize: 11.5,
              padding: "3px 0",
              borderRadius: 6,
              color: day === today.getDate() ? "#fff" : "var(--anchoran-text-primary)",
              background: day === today.getDate() ? "var(--anchoran-accent)" : "transparent",
            }}
          >
            {day ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}

interface Group {
  title: string;
  latest: AnchoranNotification;
  count: number;
  unreadCount: number;
  ids: string[];
}

/**
 * Every notification sharing a title (in this convention, the source
 * that pushed it — "Files", "Anchoran Webstore", …) collapses into one
 * group, anywhere in the list — not just when they happened to arrive
 * back-to-back. Groups are ordered by their own most recent
 * notification, so the panel still reads newest-first overall.
 */
function groupNotifications(notifications: AnchoranNotification[]): Group[] {
  const byTitle = new Map<string, Group>();
  for (const n of notifications) {
    const existing = byTitle.get(n.title);
    if (existing) {
      existing.count += 1;
      if (!n.read) existing.unreadCount += 1;
      existing.ids.push(n.id);
      // notifications arrives newest-first, so the first one seen per
      // title is already the most recent — nothing to update here.
    } else {
      byTitle.set(n.title, { title: n.title, latest: n, count: 1, unreadCount: n.read ? 0 : 1, ids: [n.id] });
    }
  }
  return Array.from(byTitle.values()).sort((a, b) => b.latest.createdAt - a.latest.createdAt);
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const snooze = useNotificationStore((s) => s.snooze);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const doNotDisturb = useNotificationStore((s) => s.doNotDisturb);
  const setDoNotDisturb = useNotificationStore((s) => s.setDoNotDisturb);

  const groups = groupNotifications(notifications);

  // Everything currently listed counts as "seen" once the panel has
  // actually been opened — mirrors the taskbar badge's own unread
  // count (see Taskbar.tsx), which this naturally clears.
  useEffect(() => {
    useNotificationStore.getState().markAllRead();
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 690 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 72,
          right: 16,
          width: 300,
          maxHeight: "65vh",
          overflowY: "auto",
          background: "var(--anchoran-surface-overlay)",
          backdropFilter: "blur(24px) saturate(1.5)",
          border: "1px solid var(--anchoran-border)",
          borderRadius: "var(--anchoran-radius-lg)",
          boxShadow: "var(--anchoran-shadow-window)",
          padding: 10,
          animation: "panel-in var(--anchoran-duration-base) var(--anchoran-ease-out)",
          transformOrigin: "bottom right",
        }}
      >
        <LiveClock />
        <MiniCalendar />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 6px 6px",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500 }}>Notifications</span>
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--anchoran-text-secondary)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Clear all
            </button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px",
            marginBottom: 4,
            borderRadius: "var(--anchoran-radius-md)",
            background: "var(--anchoran-border)",
          }}
        >
          <span style={{ fontSize: 12.5 }}>Do Not Disturb</span>
          <button
            role="switch"
            aria-checked={doNotDisturb}
            onClick={() => setDoNotDisturb(!doNotDisturb)}
            style={{
              width: 32,
              height: 18,
              borderRadius: 9,
              border: "none",
              cursor: "pointer",
              background: doNotDisturb ? "var(--anchoran-accent)" : "var(--anchoran-border-strong)",
              position: "relative",
              transition: "background 150ms ease",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: doNotDisturb ? 16 : 2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 150ms ease",
              }}
            />
          </button>
        </div>

        {groups.length === 0 ? (
          <div
            style={{
              padding: "28px 8px",
              textAlign: "center",
              color: "var(--anchoran-text-secondary)",
              fontSize: 12.5,
            }}
          >
            You're all caught up.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {groups.map((group) => (
              <div
                key={group.latest.id}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "8px 8px",
                  borderRadius: "var(--anchoran-radius-md)",
                }}
              >
                <Icon name="notification" size={15} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, display: "flex", gap: 6, alignItems: "center" }}>
                    {group.title}
                    {group.count > 1 && (
                      <span style={{ fontSize: 10.5, color: "var(--anchoran-text-secondary)" }}>
                        ({group.count})
                      </span>
                    )}
                    {group.unreadCount > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#fff",
                          background: "var(--anchoran-accent)",
                          borderRadius: 8,
                          padding: "1px 6px",
                        }}
                      >
                        {group.unreadCount} new
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>{group.latest.message}</div>
                  <div style={{ fontSize: 10.5, color: "var(--anchoran-text-disabled)", marginTop: 2 }}>
                    {formatTime(group.latest.createdAt)}
                  </div>
                  {group.latest.action && (
                    <button
                      className="app-toolbar-btn"
                      style={{ marginTop: 6, fontSize: 11.5, padding: "4px 8px" }}
                      onClick={() => {
                        group.latest.action!.onClick();
                        dismiss(group.latest.id);
                      }}
                    >
                      {group.latest.action.label}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => snooze(group.latest.id, 10)}
                  aria-label="Snooze 10 minutes"
                  title="Snooze 10 minutes"
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--anchoran-text-secondary)" }}
                >
                  <Icon name="clock" size={12} />
                </button>
                <button
                  onClick={() => group.ids.forEach(dismiss)}
                  aria-label="Dismiss"
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--anchoran-text-secondary)" }}
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
