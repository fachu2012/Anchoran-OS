import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "@/components/Icon";
import { useWindowStore, type AnchoranWindow, type Bounds } from "./windowStore";
import { APP_REGISTRY } from "@/applications/registry";
import "./window.css";

// Anchoran's taskbar floats at the bottom (see desktop.css .taskbar);
// this is how much vertical space to reserve above it so maximized/
// snapped windows never sit underneath it.
const TASKBAR_HEIGHT = 78;
const EXIT_ANIMATION_MS = 150;
const SNAP_ZONE_PX = 24;
// Keeps an "always on top" window above every ordinary window no
// matter how recently the others were focused, without needing a
// second stacking context — regular z-index values never get close
// to this range in a real session.
const ALWAYS_ON_TOP_ZINDEX_OFFSET = 100000;

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Lets the minimize animation's target point be set as inline CSS custom properties, which React's CSSProperties type doesn't otherwise allow. */
type CSSPropertiesWithVars = CSSProperties & Record<`--${string}`, string>;

const CORNER_ZONE_PX = 56;

function computeSnapZone(clientX: number, clientY: number): Bounds | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight - TASKBAR_HEIGHT;
  const halfW = Math.round(vw / 2);
  const halfH = Math.round(vh / 2);

  // Corners take priority over the plain edges below — a drag into the
  // top-left 56px square means "quarter", not "left half".
  const nearTop = clientY <= CORNER_ZONE_PX;
  const nearBottom = clientY >= vh - CORNER_ZONE_PX;
  const nearLeft = clientX <= CORNER_ZONE_PX;
  const nearRight = clientX >= vw - CORNER_ZONE_PX;
  if (nearTop && nearLeft) return { x: 0, y: 0, width: halfW, height: halfH };
  if (nearTop && nearRight) return { x: halfW, y: 0, width: vw - halfW, height: halfH };
  if (nearBottom && nearLeft) return { x: 0, y: halfH, width: halfW, height: vh - halfH };
  if (nearBottom && nearRight) return { x: halfW, y: halfH, width: vw - halfW, height: vh - halfH };

  if (clientY <= SNAP_ZONE_PX) {
    return { x: 0, y: 0, width: vw, height: vh };
  }
  if (clientX <= SNAP_ZONE_PX) {
    return { x: 0, y: 0, width: halfW, height: vh };
  }
  if (clientX >= vw - SNAP_ZONE_PX) {
    return { x: halfW, y: 0, width: vw - halfW, height: vh };
  }
  return null;
}

export function WindowFrame({ win, children }: { win: AnchoranWindow; children: ReactNode }) {
  const focusedWindowId = useWindowStore((s) => s.focusedWindowId);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const setBounds = useWindowStore((s) => s.setBounds);
  const setSnapPreview = useWindowStore((s) => s.setSnapPreview);
  const focusMode = useWindowStore((s) => s.focusMode);
  const toggleAlwaysOnTop = useWindowStore((s) => s.toggleAlwaysOnTop);
  const [exiting, setExiting] = useState<"closing" | "minimizing" | null>(null);
  const [minimizeOffset, setMinimizeOffset] = useState<{ dx: number; dy: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // The component instance is reused across minimize <-> restore (it
  // stays mounted, just renders null while minimized — see below), so
  // without this, `exiting` stays stuck at "minimizing" from the last
  // time and immediately replays that exit animation the moment the
  // window is restored, undoing the restore almost instantly.
  useEffect(() => {
    if (!win.isMinimized) {
      setExiting(null);
      setMinimizeOffset(null);
    }
  }, [win.isMinimized]);

  const minSize = APP_REGISTRY[win.appId].minSize ?? { width: 320, height: 220 };

  function requestClose() {
    setExiting("closing");
    setTimeout(() => closeWindow(win.windowId), EXIT_ANIMATION_MS);
  }

  function requestMinimize() {
    // Aim the minimize animation at this window's own taskbar icon
    // (falling back to straight down if it can't be found) instead of
    // always sliding toward the same fixed spot regardless of which
    // app it is.
    const iconEl = document.querySelector(`[data-taskbar-app="${win.appId}"]`);
    const windowEl = rootRef.current;
    if (iconEl && windowEl) {
      const iconRect = iconEl.getBoundingClientRect();
      const windowRect = windowEl.getBoundingClientRect();
      setMinimizeOffset({
        dx: iconRect.left + iconRect.width / 2 - (windowRect.left + windowRect.width / 2),
        dy: iconRect.top + iconRect.height / 2 - (windowRect.top + windowRect.height / 2),
      });
    } else {
      setMinimizeOffset(null);
    }
    setExiting("minimizing");
    setTimeout(() => minimizeWindow(win.windowId), EXIT_ANIMATION_MS);
  }

  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );
  const resizeState = useRef<{
    startX: number;
    startY: number;
    origin: Bounds;
    direction: ResizeDirection;
  } | null>(null);

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
        setSnapPreview(computeSnapZone(ev.clientX, ev.clientY));
      };
      const onUp = (ev: PointerEvent) => {
        dragState.current = null;
        const snap = computeSnapZone(ev.clientX, ev.clientY);
        if (snap) setBounds(win.windowId, snap);
        setSnapPreview(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [win, focusWindow, moveWindow, setBounds, setSnapPreview]
  );

  const onResizePointerDown = useCallback(
    (direction: ResizeDirection) => (e: ReactPointerEvent) => {
      e.stopPropagation();
      if (win.isMaximized) return;
      focusWindow(win.windowId);
      resizeState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origin: { x: win.x, y: win.y, width: win.width, height: win.height },
        direction,
      };
      const onMove = (ev: PointerEvent) => {
        if (!resizeState.current) return;
        const { startX, startY, origin, direction: dir } = resizeState.current;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let { x, y, width, height } = origin;

        if (dir.includes("e")) width = Math.max(minSize.width, origin.width + dx);
        if (dir.includes("s")) height = Math.max(minSize.height, origin.height + dy);
        if (dir.includes("w")) {
          width = Math.max(minSize.width, origin.width - dx);
          x = origin.x + (origin.width - width);
        }
        if (dir.includes("n")) {
          height = Math.max(minSize.height, origin.height - dy);
          y = origin.y + (origin.height - height);
        }

        setBounds(win.windowId, { x, y, width, height });
      };
      const onUp = () => {
        resizeState.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [win, focusWindow, setBounds, minSize]
  );

  if (win.isMinimized) return null;

  // Maximized fills the entire screen — the taskbar auto-hides itself
  // while any window is maximized (see Taskbar.tsx), so there's no
  // reason to reserve space for it here the way snapping-to-an-edge
  // still does.
  const effectiveZIndex = win.alwaysOnTop ? win.zIndex + ALWAYS_ON_TOP_ZINDEX_OFFSET : win.zIndex;
  const style = {
    ...(win.isMaximized
      ? { left: 0, top: 0, width: "100%", height: "100%", zIndex: effectiveZIndex }
      : { left: win.x, top: win.y, width: win.width, height: win.height, zIndex: effectiveZIndex }),
    ...(minimizeOffset
      ? ({ "--wm-min-dx": `${minimizeOffset.dx}px`, "--wm-min-dy": `${minimizeOffset.dy}px` } as CSSPropertiesWithVars)
      : {}),
  };

  return (
    <div
      ref={rootRef}
      className="wm-window"
      style={style}
      data-focused={isFocused}
      data-maximized={win.isMaximized}
      data-exiting={exiting ?? undefined}
      data-dimmed={focusMode && !isFocused}
      onPointerDown={() => focusWindow(win.windowId)}
    >
      <div className="wm-titlebar" onPointerDown={onTitlePointerDown} onDoubleClick={() => toggleMaximize(win.windowId)}>
        <span className="wm-titlebar-title">{win.title}</span>
        <div className="wm-titlebar-controls">
          <button
            className="wm-control-btn"
            data-active={win.alwaysOnTop}
            onClick={() => toggleAlwaysOnTop(win.windowId)}
            aria-label={win.alwaysOnTop ? "Unpin from top" : "Keep on top"}
            title={win.alwaysOnTop ? "Unpin from top" : "Keep on top"}
          >
            <Icon name="pin" size={13} />
          </button>
          <button className="wm-control-btn" onClick={requestMinimize} aria-label="Minimize">
            <Icon name="minimize" size={14} />
          </button>
          <button className="wm-control-btn" onClick={() => toggleMaximize(win.windowId)} aria-label="Maximize">
            <Icon name={win.isMaximized ? "restore" : "maximize"} size={13} />
          </button>
          <button className="wm-control-btn wm-close" onClick={requestClose} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>
      <div className="wm-body">{children}</div>
      {!win.isMaximized && (
        <>
          <div className="wm-resize-edge wm-resize-n" onPointerDown={onResizePointerDown("n")} />
          <div className="wm-resize-edge wm-resize-s" onPointerDown={onResizePointerDown("s")} />
          <div className="wm-resize-edge wm-resize-e" onPointerDown={onResizePointerDown("e")} />
          <div className="wm-resize-edge wm-resize-w" onPointerDown={onResizePointerDown("w")} />
          <div className="wm-resize-corner wm-resize-ne" onPointerDown={onResizePointerDown("ne")} />
          <div className="wm-resize-corner wm-resize-nw" onPointerDown={onResizePointerDown("nw")} />
          <div className="wm-resize-corner wm-resize-se" onPointerDown={onResizePointerDown("se")} />
          <div className="wm-resize-corner wm-resize-sw" onPointerDown={onResizePointerDown("sw")} />
        </>
      )}
    </div>
  );
}
