import { useState } from "react";
import { Wallpaper } from "./Wallpaper";
import { SystemBar } from "./SystemBar";
import { Dock } from "./Dock";
import { DesktopIcons } from "./DesktopIcons";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
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

  const desktopContextItems: ContextMenuItem[] = [
    { label: "Change Wallpaper…", onSelect: () => pushNotification("Settings", "Open Settings → Personalization to change your wallpaper.") },
    { label: "Refresh", onSelect: () => {} },
  ];

  return (
    <div
      className="desktop-root"
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <Wallpaper />
      <DesktopIcons />
      <WindowManager />
      <SystemBar
        onToggleLauncher={() => setLauncherOpen((v) => !v)}
        onToggleNotifications={() => setNotificationsOpen((v) => !v)}
        onTogglePower={() => setPowerOpen((v) => !v)}
      />
      <Dock onLauncher={() => setLauncherOpen(true)} />
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
