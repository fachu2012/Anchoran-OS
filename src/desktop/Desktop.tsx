import { useEffect, useState } from "react";
import { useWindowStore } from "@/windowmanager/windowStore";
import { Wallpaper } from "./Wallpaper";
import { Taskbar } from "./Taskbar";
import { DesktopIcons } from "./DesktopIcons";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { useDesktopIconsStore } from "./desktopIconsStore";
import { useClipboardHistoryStore } from "@/core/clipboardHistoryStore";
import { WindowManager } from "@/windowmanager/WindowManager";
import { Launcher } from "@/launcher/Launcher";
import { PowerMenu } from "@/power/PowerMenu";
import { NotificationToasts } from "@/notifications/NotificationCenter";
import { NotificationPanel } from "@/notifications/NotificationPanel";
import { useNotificationStore } from "@/notifications/notificationStore";
import "./desktop.css";

export function Desktop({
  onLock,
  onSleep,
  onShutDown,
  onRestart,
  launcherOpen,
  setLauncherOpen,
}: {
  onLock: () => void;
  onSleep: () => void;
  onShutDown: () => void;
  onRestart: () => void;
  launcherOpen: boolean;
  setLauncherOpen: (open: boolean | ((v: boolean) => boolean)) => void;
}) {
  const [powerOpen, setPowerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const pushNotification = useNotificationStore((s) => s.push);
  const cycleFocus = useWindowStore((s) => s.cycleFocus);
  const openApp = useWindowStore((s) => s.openApp);
  const clearIconPositions = useDesktopIconsStore((s) => s.clearPositions);

  useEffect(() => {
    // Ctrl+Tab / Ctrl+Shift+Tab: Anchoran's own window switcher. Not
    // bound to literal Alt+Tab — Windows owns that combination at the
    // shell level the same way it owns the bare Windows key, so a
    // normal Electron app can't reliably intercept it (see the
    // Windows-key note in electron/main.ts).
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        cycleFocus(e.shiftKey ? -1 : 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cycleFocus]);

  const recordClipboard = useClipboardHistoryStore((s) => s.record);
  useEffect(() => {
    function onCopy() {
      const text = window.getSelection()?.toString();
      if (text) recordClipboard(text);
    }
    window.addEventListener("copy", onCopy);
    return () => window.removeEventListener("copy", onCopy);
  }, [recordClipboard]);

  const desktopContextItems: ContextMenuItem[] = [
    { label: "Sort Icons", onSelect: () => clearIconPositions() },
    {
      label: "Change Wallpaper…",
      onSelect: () => {
        openApp("settings");
        pushNotification("Settings", "Choose your wallpaper under Personalization.");
      },
    },
    { label: "Refresh", onSelect: () => {} },
  ];

  return (
    <div
      className="desktop-root"
      onContextMenu={(e) => {
        e.preventDefault();
        // Only the desktop background itself gets this menu — a
        // right-click that bubbled up from inside an app window or the
        // taskbar/dock (because that spot has no context menu of its
        // own) should just do nothing, not fall back to this one.
        const target = e.target as HTMLElement;
        if (target.closest(".wm-window") || target.closest(".taskbar") || target.closest(".taskbar-hotzone")) {
          return;
        }
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <Wallpaper />
      <DesktopIcons />
      <WindowManager />
      <Taskbar
        onLauncher={() => setLauncherOpen((v) => !v)}
        onToggleNotifications={() => setNotificationsOpen((v) => !v)}
        onTogglePower={() => setPowerOpen((v) => !v)}
      />
      <NotificationToasts />
      {notificationsOpen && <NotificationPanel onClose={() => setNotificationsOpen(false)} />}

      {launcherOpen && (
        <Launcher onClose={() => setLauncherOpen(false)} onPower={() => setPowerOpen(true)} />
      )}

      {powerOpen && (
        <PowerMenu
          onClose={() => setPowerOpen(false)}
          onLock={() => {
            setPowerOpen(false);
            onLock();
          }}
          onSleep={() => {
            setPowerOpen(false);
            onSleep();
          }}
          onRestart={() => {
            setPowerOpen(false);
            onRestart();
          }}
          onShutDown={() => {
            setPowerOpen(false);
            onShutDown();
          }}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={desktopContextItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
