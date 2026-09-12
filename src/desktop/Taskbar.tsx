import { useState, type DragEvent } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { APP_REGISTRY } from "@/applications/registry";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useNotificationStore } from "@/notifications/notificationStore";
import { useTaskbarStore } from "./taskbarStore";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { useSystemStatus } from "./systemStatus";
import { QuickSettingsPanel } from "./QuickSettingsPanel";
import { Clock } from "./Clock";
import { AdminPinPrompt } from "@/core/AdminPinPrompt";
import type { AppId } from "@/core/types";

const DRAG_MIME = "application/x-anchoran-taskbar-app";

/**
 * Anchoran's single floating taskbar: Launcher, pinned + running apps
 * (Anchoran's task switcher) on the left, system tray + clock + power
 * on the right — one bar instead of a separate top system bar and
 * bottom dock. Pinned apps can be reordered by dragging, and any icon
 * can be pinned/unpinned via right-click.
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

  const pinned = useTaskbarStore((s) => s.pinned);
  const pin = useTaskbarStore((s) => s.pin);
  const unpin = useTaskbarStore((s) => s.unpin);
  const reorder = useTaskbarStore((s) => s.reorder);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; appId: AppId } | null>(null);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [adminPinPrompt, setAdminPinPrompt] = useState(false);

  // Auto-hide, like a real OS taskbar: while any window is maximized,
  // the bar slides out of the way so the app can truly fill the
  // screen, and reappears when the mouse approaches the bottom edge
  // (or leaves it once a window stops being maximized/minimizes).
  const anyMaximized = windows.some((w) => w.isMaximized && !w.isMinimized);
  const [revealed, setRevealed] = useState(false);

  // Pinned apps always show, in the user's chosen order; any other app
  // with an open window is appended after them, so the bar also works
  // as a real task list.
  const extraOpenAppIds = Array.from(new Set(windows.map((w) => w.appId))).filter(
    (id) => !pinned.includes(id)
  );
  const taskbarAppIds: AppId[] = [...pinned, ...extraOpenAppIds];

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

  function onIconDragStart(e: DragEvent, index: number) {
    e.dataTransfer.setData(DRAG_MIME, String(index));
    e.dataTransfer.effectAllowed = "move";
  }

  function onIconDrop(e: DragEvent, targetIndex: number) {
    e.preventDefault();
    setDragOverIndex(null);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    const fromIndex = Number(raw);
    if (Number.isNaN(fromIndex) || fromIndex === targetIndex || fromIndex >= pinned.length) return;
    reorder(fromIndex, targetIndex);
  }

  function contextItemsFor(appId: AppId): ContextMenuItem[] {
    const isPinned = pinned.includes(appId);
    const items: ContextMenuItem[] = [
      isPinned
        ? { label: "Unpin from taskbar", onSelect: () => unpin(appId) }
        : { label: "Pin to taskbar", onSelect: () => pin(appId) },
    ];
    if (appId === "terminal") {
      items.push({ label: "Run as Administrator", icon: "lock", onSelect: () => setAdminPinPrompt(true) });
    }
    return items;
  }

  const batteryPercent = Math.round(status.batteryLevel * 100);

  const hidden = anyMaximized && !revealed;

  return (
    <>
      {anyMaximized && <div className="taskbar-hotzone" onMouseEnter={() => setRevealed(true)} />}
      <nav
        className="taskbar"
        data-hidden={hidden}
        onMouseLeave={() => anyMaximized && setRevealed(false)}
      >
        <button className="taskbar-btn taskbar-launcher" onClick={onLauncher} aria-label="Launcher">
          <Icon name="launcher" size={18} />
        </button>

        <div className="taskbar-divider" />

        <div className="taskbar-apps">
          {taskbarAppIds.map((appId, index) => {
            const app = APP_REGISTRY[appId];
            const appWindows = windows.filter((w) => w.appId === appId);
            const isOpen = appWindows.length > 0;
            const isFocused = appWindows.some((w) => w.windowId === focusedWindowId && !w.isMinimized);
            const isPinned = pinned.includes(appId);
            return (
              <button
                key={appId}
                className="taskbar-btn"
                data-open={isOpen}
                data-focused={isFocused}
                data-drag-over={isPinned && dragOverIndex === index}
                draggable={isPinned}
                onDragStart={(e) => isPinned && onIconDragStart(e, index)}
                onDragOver={(e) => {
                  if (!isPinned) return;
                  e.preventDefault();
                  setDragOverIndex(index);
                }}
                onDragLeave={() => setDragOverIndex((i) => (i === index ? null : i))}
                onDrop={(e) => isPinned && onIconDrop(e, index)}
                onClick={() => onAppIconClick(appId)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, appId });
                }}
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
          <button
            className="taskbar-btn taskbar-tray-btn"
            onClick={() => setQuickSettingsOpen((v) => !v)}
            aria-label="Quick settings"
            data-op={quickSettingsOpen}
          >
            <Icon name="wifi" size={16} style={{ opacity: status.online ? 1 : 0.35 }} />
            <Icon name="volume" size={16} />
            <div className="taskbar-battery" title={status.batterySupported ? `${batteryPercent}%${status.charging ? " (charging)" : ""}` : undefined}>
              <Icon name="battery" size={16} />
              {status.batterySupported && <span className="taskbar-battery-label">{batteryPercent}%</span>}
            </div>
          </button>
          <Clock />
        </div>

        <div className="taskbar-divider" />

        <button className="taskbar-btn" onClick={onTogglePower} aria-label="Power">
          <Icon name="power" size={16} />
        </button>
      </nav>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItemsFor(contextMenu.appId)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {quickSettingsOpen && <QuickSettingsPanel onClose={() => setQuickSettingsOpen(false)} />}

      {adminPinPrompt && (
        <AdminPinPrompt
          onCancel={() => setAdminPinPrompt(false)}
          onSuccess={() => {
            setAdminPinPrompt(false);
            openApp("terminal", { startAdmin: true });
          }}
        />
      )}
    </>
  );
}
