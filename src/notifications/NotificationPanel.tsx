import { Icon } from "@/components/Icon";
import { useNotificationStore, type AnchoranNotification } from "./notificationStore";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Group {
  title: string;
  latest: AnchoranNotification;
  count: number;
  ids: string[];
}

/** Consecutive notifications sharing a title collapse into one group with a count. */
function groupNotifications(notifications: AnchoranNotification[]): Group[] {
  const groups: Group[] = [];
  for (const n of notifications) {
    const last = groups[groups.length - 1];
    if (last && last.title === n.title) {
      last.count += 1;
      last.ids.push(n.id);
    } else {
      groups.push({ title: n.title, latest: n, count: 1, ids: [n.id] });
    }
  }
  return groups;
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const snooze = useNotificationStore((s) => s.snooze);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const doNotDisturb = useNotificationStore((s) => s.doNotDisturb);
  const setDoNotDisturb = useNotificationStore((s) => s.setDoNotDisturb);

  const groups = groupNotifications(notifications);

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
                  </div>
                  <div style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>{group.latest.message}</div>
                  <div style={{ fontSize: 10.5, color: "var(--anchoran-text-disabled)", marginTop: 2 }}>
                    {formatTime(group.latest.createdAt)}
                  </div>
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
