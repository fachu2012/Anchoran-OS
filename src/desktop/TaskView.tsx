import { Icon, type IconName } from "@/components/Icon";
import { IconTile } from "@/components/IconTile";
import { APP_REGISTRY } from "@/applications/registry";
import { useWindowStore } from "@/windowmanager/windowStore";
import "./taskview.css";

/**
 * Task View — every open window as a card you can jump straight to,
 * the same job as Windows' own Task View / Alt-Tab overview. Anchoran
 * already has Ctrl+Tab for cycling focus one window at a time; this is
 * the "see everything open at once and pick one" complement to that,
 * opened from its own taskbar button.
 */
export function TaskView({ onClose }: { onClose: () => void }) {
  const windows = useWindowStore((s) => s.windows);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);

  function open(windowId: string, isMinimized: boolean) {
    if (isMinimized) restoreWindow(windowId);
    else focusWindow(windowId);
    onClose();
  }

  return (
    <div className="taskview-backdrop" onClick={onClose} onContextMenu={(e) => e.stopPropagation()}>
      <div className="taskview-panel" onClick={(e) => e.stopPropagation()}>
        <div className="taskview-header">
          <span>Task View</span>
          <button className="taskview-close" onClick={onClose} aria-label="Close Task View">
            <Icon name="close" size={16} />
          </button>
        </div>
        {windows.length === 0 ? (
          <div className="taskview-empty">No windows open.</div>
        ) : (
          <div className="taskview-grid">
            {windows.map((win) => {
              const app = APP_REGISTRY[win.appId];
              return (
                <div
                  key={win.windowId}
                  className="taskview-card"
                  data-minimized={win.isMinimized}
                  onClick={() => open(win.windowId, win.isMinimized)}
                >
                  <button
                    className="taskview-card-close"
                    aria-label={`Close ${win.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeWindow(win.windowId);
                    }}
                  >
                    <Icon name="close" size={11} />
                  </button>
                  <IconTile name={app.icon as IconName} size={44} glyphScale={0.54} />
                  <span className="taskview-card-title">{win.title}</span>
                  {win.isMinimized && <span className="taskview-card-badge">Minimized</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
