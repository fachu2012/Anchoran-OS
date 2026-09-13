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
import { TaskView } from "./TaskView";
import { PowerMenu } from "@/power/PowerMenu";
import { NotificationToasts } from "@/notifications/NotificationCenter";
import { NotificationPanel } from "@/notifications/NotificationPanel";
import { useNotificationStore } from "@/notifications/notificationStore";
import { useShortcutPrefsStore, matchesModifier } from "@/core/shortcutPrefsStore";
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
  const [taskViewOpen, setTaskViewOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const pushNotification = useNotificationStore((s) => s.push);
  const cycleFocus = useWindowStore((s) => s.cycleFocus);
  const openApp = useWindowStore((s) => s.openApp);
  const clearIconPositions = useDesktopIconsStore((s) => s.clearPositions);
  const setBounds = useWindowStore((s) => s.setBounds);
  const resizeWindow = useWindowStore((s) => s.resizeWindow);

  useEffect(() => {
    // Ctrl+Tab / Ctrl+Shift+Tab: Anchoran's own window switcher. Not
    // bound to literal Alt+Tab — Windows owns that combination at the
    // shell level the same way it owns the bare Windows key, so a
    // normal Electron app can't reliably intercept it (see the
    // Windows-key note in electron/main.ts).
    //
    // Ctrl+Alt+Left/Right/Down snap the focused window to a third of
    // the screen — the keyboard-only counterpart to dragging into a
    // corner for a quarter. Ctrl+Shift+Arrow resizes the focused
    // window in fixed steps, for anyone who'd rather not drag an edge.
    const THIRD_STEP = 24;
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        cycleFocus(e.shiftKey ? -1 : 1);
        return;
      }

      const { focusedWindowId, windows } = useWindowStore.getState();
      const focused = windows.find((w) => w.windowId === focusedWindowId);
      if (!focused) return;

      const { desktopModifier, resizeModifier } = useShortcutPrefsStore.getState();
      if (matchesModifier(e, desktopModifier) && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowDown")) {
        e.preventDefault();
        const vw = window.innerWidth;
        const vh = window.innerHeight - 78; // taskbar height, see WindowFrame.tsx
        const thirdW = Math.round(vw / 3);
        const bounds =
          e.key === "ArrowLeft"
            ? { x: 0, y: 0, width: thirdW, height: vh }
            : e.key === "ArrowRight"
              ? { x: vw - thirdW, y: 0, width: thirdW, height: vh }
              : { x: thirdW, y: 0, width: vw - thirdW * 2, height: vh };
        setBounds(focused.windowId, bounds);
      } else if (matchesModifier(e, resizeModifier) && e.key.startsWith("Arrow") && !focused.isMaximized) {
        e.preventDefault();
        const dw = e.key === "ArrowLeft" ? -THIRD_STEP : e.key === "ArrowRight" ? THIRD_STEP : 0;
        const dh = e.key === "ArrowUp" ? -THIRD_STEP : e.key === "ArrowDown" ? THIRD_STEP : 0;
        resizeWindow(focused.windowId, Math.max(240, focused.width + dw), Math.max(160, focused.height + dh));
      }
    }

    // Cycles between virtual desktops, sharing its modifier with the
    // thirds-snap above (Page Up/Down never overlaps Arrow keys).
    function onDesktopSwitchKeyDown(e: KeyboardEvent) {
      const { desktopModifier } = useShortcutPrefsStore.getState();
      if (!matchesModifier(e, desktopModifier) || (e.key !== "PageUp" && e.key !== "PageDown")) return;
      e.preventDefault();
      const { desktops, activeDesktopId, switchDesktop } = useWindowStore.getState();
      const index = desktops.indexOf(activeDesktopId);
      const direction = e.key === "PageDown" ? 1 : -1;
      const nextIndex = (index + direction + desktops.length) % desktops.length;
      switchDesktop(desktops[nextIndex]);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onDesktopSwitchKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onDesktopSwitchKeyDown);
    };
  }, [cycleFocus, setBounds, resizeWindow]);

  // A clear, unmissable notification when a USB stick or network
  // drive actually appears or disappears — previously the only way to
  // notice was to happen to reopen Files and see a new drive letter
  // already sitting there.
  useEffect(() => {
    window.anchoran?.onDriveConnected((drive) => {
      pushNotification("Drive connected", `${drive} is now available in Files.`, {
        label: "Open Files",
        onClick: () => useWindowStore.getState().openApp("files"),
      });
    });
    window.anchoran?.onDriveDisconnected((drive) => {
      pushNotification("Drive disconnected", `${drive} was removed.`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        onToggleTaskView={() => setTaskViewOpen((v) => !v)}
      />
      <NotificationToasts />
      {notificationsOpen && <NotificationPanel onClose={() => setNotificationsOpen(false)} />}
      {taskViewOpen && <TaskView onClose={() => setTaskViewOpen(false)} />}

      {launcherOpen && (
        <Launcher
          onClose={() => setLauncherOpen(false)}
          onPower={() => setPowerOpen(true)}
          onLock={onLock}
          onSleep={onSleep}
          onRestart={onRestart}
          onShutDown={onShutDown}
        />
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
          onSignOut={() => {
            setPowerOpen(false);
            useWindowStore.getState().closeAllWindows();
            // Guest is a single permanent profile — it stays in the list and
            // resets itself the next time it's entered, nothing to clean up here.
            onLock();
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
