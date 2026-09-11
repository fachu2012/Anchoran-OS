import { Icon } from "@/components/Icon";
import { useNotificationStore } from "./notificationStore";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const clearAll = useNotificationStore((s) => s.clearAll);

  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 690 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 48,
          right: 14,
          width: 300,
          maxHeight: "70vh",
          overflowY: "auto",
          background: "var(--anchoran-surface)",
          border: "1px solid var(--anchoran-border)",
          borderRadius: "var(--anchoran-radius-lg)",
          boxShadow: "var(--anchoran-shadow-window)",
          padding: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 6px 10px",
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

        {notifications.length === 0 ? (
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
            {notifications.map((n) => (
              <div
                key={n.id}
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
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>{n.message}</div>
                  <div style={{ fontSize: 10.5, color: "var(--anchoran-text-disabled)", marginTop: 2 }}>
                    {formatTime(n.createdAt)}
                  </div>
                </div>
                <button
                  onClick={() => dismiss(n.id)}
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
