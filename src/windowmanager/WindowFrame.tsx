import { useCallback, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "@/components/Icon";
import { useWindowStore, type AnchoranWindow } from "./windowStore";
import "./window.css";

const TASKBAR_HEIGHT = 0; // reserved for future docked layouts

export function WindowFrame({ win, children }: { win: AnchoranWindow; children: ReactNode }) {
  const focusedWindowId = useWindowStore((s) => s.focusedWindowId);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const resizeWindow = useWindowStore((s) => s.resizeWindow);

  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );
  const resizeState = useRef<{ startX: number; startY: number; originW: number; originH: number } | null>(
    null
  );

  const isFocused = focusedWindowId === win.windowId;

  const onTitlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (win.isMaximized) return;
      focusWindow(win.windowId);
      dragState.current = { startX: e.clientX, startY: e.clientY, originX: win.x, originY: win.y };
      const onMove = (ev: PointerEvent) => {
        if (!dragState.current) return;
        const dx = ev.clientX - dragState.current.startX;
        const dy = ev.clientY - dragState.current.startY;
        moveWindow(win.windowId, dragState.current.originX + dx, Math.max(0, dragState.current.originY + dy));
      };
      const onUp = () => {
        dragState.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [win, focusWindow, moveWindow]
  );

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      e.stopPropagation();
      if (win.isMaximized) return;
      focusWindow(win.windowId);
      resizeState.current = { startX: e.clientX, startY: e.clientY, originW: win.width, originH: win.height };
      const onMove = (ev: PointerEvent) => {
        if (!resizeState.current) return;
        const dx = ev.clientX - resizeState.current.startX;
        const dy = ev.clientY - resizeState.current.startY;
        resizeWindow(
          win.windowId,
          Math.max(320, resizeState.current.originW + dx),
          Math.max(220, resizeState.current.originH + dy)
        );
      };
      const onUp = () => {
        resizeState.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [win, focusWindow, resizeWindow]
  );

  if (win.isMinimized) return null;

  const style = win.isMaximized
    ? { left: 0, top: 0, width: "100%", height: `calc(100% - ${TASKBAR_HEIGHT}px)`, zIndex: win.zIndex }
    : { left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex };

  return (
    <div
      className="wm-window"
      style={style}
      data-focused={isFocused}
      onPointerDown={() => focusWindow(win.windowId)}
    >
      <div className="wm-titlebar" onPointerDown={onTitlePointerDown} onDoubleClick={() => toggleMaximize(win.windowId)}>
        <span className="wm-titlebar-title">{win.title}</span>
        <div className="wm-titlebar-controls">
          <button className="wm-control-btn" onClick={() => minimizeWindow(win.windowId)} aria-label="Minimize">
            <Icon name="minimize" size={14} />
          </button>
          <button className="wm-control-btn" onClick={() => toggleMaximize(win.windowId)} aria-label="Maximize">
            <Icon name={win.isMaximized ? "restore" : "maximize"} size={13} />
          </button>
          <button className="wm-control-btn wm-close" onClick={() => closeWindow(win.windowId)} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>
      <div className="wm-body">{children}</div>
      {!win.isMaximized && <div className="wm-resize-handle" onPointerDown={onResizePointerDown} />}
    </div>
  );
}
