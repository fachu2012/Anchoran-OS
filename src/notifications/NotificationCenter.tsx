import { useNotificationStore } from "./notificationStore";
import { Icon } from "@/components/Icon";

export function NotificationToasts() {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);

  return (
    <div
      style={{
        position: "absolute",
        top: 50,
        right: 14,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 800,
        width: 280,
      }}
    >
      {notifications.slice(0, 4).map((n) => (
        <div
          key={n.id}
          style={{
            background: "var(--anchoran-surface)",
            border: "1px solid var(--anchoran-border)",
            borderRadius: "var(--anchoran-radius-md)",
            boxShadow: "var(--anchoran-shadow-soft)",
            padding: "10px 12px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Icon name="notification" size={16} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{n.title}</div>
            <div style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>{n.message}</div>
          </div>
          <button
            onClick={() => dismiss(n.id)}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--anchoran-text-secondary)" }}
            aria-label="Dismiss"
          >
            <Icon name="close" size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
