import { Icon, type IconName } from "@/components/Icon";
import { APP_REGISTRY } from "@/applications/registry";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useNotificationStore } from "@/notifications/notificationStore";
import { useSystemStatus } from "./systemStatus";
import { Clock } from "./Clock";
import type { AppId } from "@/core/types";

const PINNED: AppId[] = ["files", "terminal", "browser", "notes", "settings"];

/**
 * Anchoran's single floating taskbar: Launcher, pinned + running apps
 * (Anchoran's task switcher) on the left, system tray + clock + power
 * on the right — one bar instead of a separate top system bar and
 * bottom dock.
 */
export function Taskbar({
  onLauncher,
  onToggleNotifications,
  onTogglePower,
}: {
  onLauncher: () => void;
  onToggleNotifications: () => void;
  onTogglePower: () => void;
}) {
  const openApp = useWindowStore((s) => s.openApp);
  const windows = useWindowStore((s) => s.windows);
  const focusedWindowId = useWindowStore((s) => s.focusedWindowId);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const notificationCount = useNotificationStore((s) => s.notifications.length);
  const status = useSystemStatus();

  // Pinned apps always show; any other app with an open window is
  // appended after them, so the bar also works as a real task list.
  const extraOpenAppIds = Array.from(new Set(windows.map((w) => w.appId))).filter(
    (id) => !PINNED.includes(id)
  );
  const taskbarAppIds: AppId[] = [...PINNED, ...extraOpenAppIds];

  function onAppIconClick(appId: AppId) {
    const appWindows = windows.filter((w) => w.appId === appId);
    if (appWindows.length === 0) {
      openApp(appId);
      return;
    }
    const focused = appWindows.find((w) => w.windowId === focusedWindowId && !w.isMinimized);
    if (focused) {
      minimizeWindow(focused.windowId);
      return;
    }
    const minimized = appWindows.find((w) => w.isMinimized);
    if (minimized) restoreWindow(minimized.windowId);
    else focusWindow(appWindows[0].windowId);
  }

  const batteryPercent = Math.round(status.batteryLevel * 100);

  return (
    <nav className="taskbar">
      <button className="taskbar-btn taskbar-launcher" onClick={onLauncher} aria-label="Launcher">
        <Icon name="launcher" size={18} />
      </button>

      <div className="taskbar-divider" />

      <div className="taskbar-apps">
        {taskbarAppIds.map((appId) => {
          const app = APP_REGISTRY[appId];
          const appWindows = windows.filter((w) => w.appId === appId);
          const isOpen = appWindows.length > 0;
          const isFocused = appWindows.some((w) => w.windowId === focusedWindowId && !w.isMinimized);
          return (
            <button
              key={appId}
              className="taskbar-btn"
              data-open={isOpen}
              data-focused={isFocused}
              onClick={() => onAppIconClick(appId)}
              aria-label={app.title}
              title={app.title}
            >
              <Icon name={app.icon as IconName} size={18} />
              {isOpen && <span className="taskbar-dot" />}
            </button>
          );
        })}
      </div>

      <div className="taskbar-spacer" />

      <div className="taskbar-tray">
        <button className="taskbar-btn" onClick={onToggleNotifications} aria-label="Notifications">
          <Icon name="notification" size={16} />
          {notificationCount > 0 && <span className="taskbar-badge">{notificationCount}</span>}
        </button>
        <Icon name="wifi" size={16} style={{ opacity: status.online ? 1 : 0.35 }} aria-label={status.online ? "Online" : "Offline"} />
        <Icon name="volume" size={16} />
        <div className="taskbar-battery" title={status.batterySupported ? `${batteryPercent}%${status.charging ? " (charging)" : ""}` : undefined}>
          <Icon name="battery" size={16} />
          {status.batterySupported && <span className="taskbar-battery-label">{batteryPercent}%</span>}
        </div>
        <Clock />
      </div>

      <div className="taskbar-divider" />

      <button className="taskbar-btn" onClick={onTogglePower} aria-label="Power">
        <Icon name="power" size={16} />
      </button>
    </nav>
  );
}
