import { Icon } from "@/components/Icon";
import { Clock } from "./Clock";
import { useNotificationStore } from "@/notifications/notificationStore";

export function SystemBar({
  onToggleLauncher,
  onToggleNotifications,
  onTogglePower,
}: {
  onToggleLauncher: () => void;
  onToggleNotifications: () => void;
  onTogglePower: () => void;
}) {
  const notificationCount = useNotificationStore((s) => s.notifications.length);

  return (
    <header className="system-bar">
      <div className="system-bar-left">
        <button className="system-bar-btn system-bar-brand" onClick={onToggleLauncher}>
          <Icon name="launcher" size={16} />
          Anchoran
        </button>
      </div>
      <div className="system-bar-right">
        <button className="system-bar-btn" onClick={onToggleNotifications} aria-label="Notifications">
          <Icon name="notification" size={16} />
          {notificationCount > 0 && (
            <span
              style={{
                fontSize: 10,
                background: "var(--anchoran-accent)",
                color: "#fff",
                borderRadius: 8,
                padding: "0 5px",
              }}
            >
              {notificationCount}
            </span>
          )}
        </button>
        <Icon name="wifi" size={16} />
        <Icon name="volume" size={16} />
        <Icon name="battery" size={16} />
        <Clock />
        <button className="system-bar-btn" onClick={onTogglePower} aria-label="Power">
          <Icon name="power" size={16} />
        </button>
      </div>
    </header>
  );
}
