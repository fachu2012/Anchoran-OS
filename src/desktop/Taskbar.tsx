import { useRef, useState, type DragEvent } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { IconTile } from "@/components/IconTile";
import { APP_REGISTRY } from "@/applications/registry";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useNotificationStore } from "@/notifications/notificationStore";
import { useTaskbarStore } from "./taskbarStore";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { useSystemStatus } from "./systemStatus";
import { QuickSettingsPanel } from "./QuickSettingsPanel";
import { Clock } from "./Clock";
import { AdminPinPrompt } from "@/core/AdminPinPrompt";
import { AnchoranLogo } from "@/components/AnchoranLogo";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { useUpdateAvailableStore } from "@/core/updateAvailableStore";
import { versionLabelFor } from "@/core/buildNumber";
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
  onToggleTaskView,
}: {
  onLauncher: () => void;
  onToggleNotifications: () => void;
  onTogglePower: () => void;
  onToggleTaskView: () => void;
}) {
  const openApp = useWindowStore((s) => s.openApp);
  const allWindows = useWindowStore((s) => s.windows);
  const focusedWindowId = useWindowStore((s) => s.focusedWindowId);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const desktops = useWindowStore((s) => s.desktops);
  const activeDesktopId = useWindowStore((s) => s.activeDesktopId);
  const addDesktop = useWindowStore((s) => s.addDesktop);
  const removeDesktop = useWindowStore((s) => s.removeDesktop);
  const switchDesktop = useWindowStore((s) => s.switchDesktop);
  // The taskbar only lists windows on the current virtual desktop —
  // the same "what's actually visible right now" list a real OS shows.
  const windows = allWindows.filter((w) => w.desktopId === activeDesktopId);
  const notificationCount = useNotificationStore((s) => s.notifications.filter((n) => !n.read).length);
  const accentColor = usePreferencesStore((s) => s.accentColor);
  const updateStatus = useUpdateAvailableStore((s) => s.status);
  const updateVersion = useUpdateAvailableStore((s) => s.version);
  const status = useSystemStatus();

  const pinned = useTaskbarStore((s) => s.pinned);
  const pin = useTaskbarStore((s) => s.pin);
  const unpin = useTaskbarStore((s) => s.unpin);
  const reorder = useTaskbarStore((s) => s.reorder);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; appId: AppId } | null>(null);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [adminPinPrompt, setAdminPinPrompt] = useState(false);
  // A single icon already represents every window of that app (grouped
  // by appId below) — when there's more than one, hovering the icon
  // lists each window by title so you can jump to a specific one
  // instead of only cycling through them by clicking.
  const [hoverAppId, setHoverAppId] = useState<AppId | null>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openHoverPreview(appId: AppId) {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    setHoverAppId(appId);
  }

  function scheduleHoverClose() {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = setTimeout(() => setHoverAppId(null), 200);
  }

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

  const moveWindowToDesktop = useWindowStore((s) => s.moveWindowToDesktop);

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
    const appWindow = windows.find((w) => w.appId === appId);
    const otherDesktops = desktops.filter((id) => id !== activeDesktopId);
    if (appWindow && otherDesktops.length > 0) {
      for (const id of otherDesktops) {
        items.push({ label: `Move to Desktop ${id}`, onSelect: () => moveWindowToDesktop(appWindow.windowId, id) });
      }
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
          <AnchoranLogo size={20} color={accentColor} />
        </button>
        <button className="taskbar-btn" onClick={onToggleTaskView} aria-label="Task View" title="Task View">
          <Icon name="taskView" size={17} />
        </button>

        <div className="taskbar-desktops">
          {desktops.map((id) => (
            <button
              key={id}
              className="taskbar-desktop-pill"
              data-active={id === activeDesktopId}
              onClick={() => switchDesktop(id)}
              onAuxClick={(e) => {
                if (e.button === 1 && desktops.length > 1) removeDesktop(id);
              }}
              title={`Desktop ${id}${desktops.length > 1 ? " (middle-click to close)" : ""}`}
            >
              {id}
            </button>
          ))}
          <button className="taskbar-desktop-add" onClick={addDesktop} aria-label="New virtual desktop" title="New virtual desktop">
            <Icon name="plus" size={12} />
          </button>
        </div>

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
                data-taskbar-app={appId}
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
                onMouseEnter={() => appWindows.length > 1 && openHoverPreview(appId)}
                onMouseLeave={() => scheduleHoverClose()}
                aria-label={app.title}
                title={appWindows.length <= 1 ? app.title : undefined}
              >
                <IconTile name={app.icon as IconName} size={26} glyphScale={0.62} />
                {isOpen && <span className="taskbar-dot" />}
                {appWindows.length > 1 && hoverAppId === appId && (
                  <div
                    className="taskbar-window-preview"
                    onMouseEnter={() => openHoverPreview(appId)}
                    onMouseLeave={() => scheduleHoverClose()}
                  >
                    <div className="taskbar-window-preview-title">{app.title}</div>
                    {appWindows.map((w) => (
                      <button
                        key={w.windowId}
                        className="taskbar-window-preview-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHoverAppId(null);
                          if (w.isMinimized) restoreWindow(w.windowId);
                          else focusWindow(w.windowId);
                        }}
                      >
                        {w.title}
                      </button>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="taskbar-spacer" />

        <div className="taskbar-tray">
          {updateStatus !== "none" && (
            <button
              className="taskbar-btn"
              onClick={() => openApp("settings")}
              aria-label={`Update ${updateStatus}${updateVersion ? `: ${versionLabelFor(updateVersion)}` : ""}`}
              title={
                updateStatus === "downloaded"
                  ? `Update ${updateVersion ? versionLabelFor(updateVersion) : "?"} ready — restart to install`
                  : updateStatus === "downloading"
                    ? "Downloading update…"
                    : `Update ${updateVersion ? versionLabelFor(updateVersion) : "?"} available`
              }
            >
              <Icon name="restart" size={15} style={{ color: "var(--anchoran-accent)" }} />
              <span className="taskbar-dot" />
            </button>
          )}
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
          <button className="taskbar-btn taskbar-clock-btn" onClick={onToggleNotifications} aria-label="Date, time and notifications">
            <Clock />
            {notificationCount > 0 && <span className="taskbar-badge">{notificationCount}</span>}
          </button>
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
