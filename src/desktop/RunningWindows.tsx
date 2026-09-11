import { Icon, type IconName } from "@/components/Icon";
import { APP_REGISTRY } from "@/applications/registry";
import { useWindowStore } from "@/windowmanager/windowStore";

/**
 * A running-apps strip in the system bar. This is Anchoran's task
 * switcher: it lists every open window (minimized or not) so a
 * minimized window — including a second Terminal or Notes instance —
 * always has a way back, not just the single-instance apps the Dock
 * can re-focus on its own.
 */
export function RunningWindows() {
  const windows = useWindowStore((s) => s.windows);
  const focusedWindowId = useWindowStore((s) => s.focusedWindowId);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);

  if (windows.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {windows.map((win) => {
        const def = APP_REGISTRY[win.appId];
        const isActive = win.windowId === focusedWindowId && !win.isMinimized;
        return (
          <button
            key={win.windowId}
            className="system-bar-btn"
            title={win.title}
            style={{
              background: isActive ? "var(--anchoran-accent-soft)" : undefined,
              color: isActive ? "var(--anchoran-accent)" : undefined,
              opacity: win.isMinimized ? 0.55 : 1,
            }}
            onClick={() => {
              if (win.isMinimized) restoreWindow(win.windowId);
              else if (isActive) minimizeWindow(win.windowId);
              else focusWindow(win.windowId);
            }}
          >
            <Icon name={def.icon as IconName} size={14} />
          </button>
        );
      })}
    </div>
  );
}
