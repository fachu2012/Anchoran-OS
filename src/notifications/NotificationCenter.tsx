import { useEffect, useRef, useState } from "react";
import { useNotificationStore } from "./notificationStore";
import { Icon } from "@/components/Icon";
import "./notifications.css";

const AUTO_HIDE_MS = 6000;

/**
 * Toasts are a transient *view* over the notification history: they
 * fade out on their own after a few seconds, but dismissing one only
 * hides it here — the notification itself stays in the persistent
 * history shown by NotificationPanel until the user clears it there.
 */
export function NotificationToasts() {
  const notifications = useNotificationStore((s) => s.notifications);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  // One independent countdown per toast, keyed by id — re-keying this
  // off `[notifications.length]` used to restart every still-visible
  // toast's whole 6s countdown from zero each time a new notification
  // arrived, so a steady stream of them meant none ever auto-hid.
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  const visible = notifications.filter((n) => !hiddenIds.has(n.id) && !n.silent).slice(0, 4);

  useEffect(() => {
    for (const n of visible) {
      if (timeoutsRef.current.has(n.id)) continue;
      const id = window.setTimeout(() => {
        setLeavingIds((prev) => new Set(prev).add(n.id));
        setTimeout(() => setHiddenIds((prev) => new Set(prev).add(n.id)), 170);
        timeoutsRef.current.delete(n.id);
      }, AUTO_HIDE_MS);
      timeoutsRef.current.set(n.id, id);
    }
  });

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((id) => clearTimeout(id));
    };
  }, []);

  function dismiss(id: string) {
    const scheduled = timeoutsRef.current.get(id);
    if (scheduled) {
      clearTimeout(scheduled);
      timeoutsRef.current.delete(id);
    }
    setLeavingIds((prev) => new Set(prev).add(id));
    setTimeout(() => setHiddenIds((prev) => new Set(prev).add(id)), 170);
  }

  return (
    <div className="toast-stack">
      {visible.map((n) => (
        <div key={n.id} className="toast" data-leaving={leavingIds.has(n.id)}>
          <Icon name="notification" size={16} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{n.title}</div>
            <div style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>{n.message}</div>
            {n.action && (
              <button
                className="app-toolbar-btn"
                style={{ marginTop: 6, fontSize: 11.5, padding: "4px 8px" }}
                onClick={() => {
                  n.action!.onClick();
                  dismiss(n.id);
                }}
              >
                {n.action.label}
              </button>
            )}
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
