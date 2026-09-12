import { useEffect, useRef, useState } from "react";
import { useWindowStore } from "@/windowmanager/windowStore";
import { AnchoranFilePicker } from "@/core/AnchoranFilePicker";
import "@/applications/apps.css";
import "./embeddedapp.css";

/**
 * A real external Windows app, reparented into this Anchoran window —
 * see electron/main.ts's embed-* handlers and
 * native/windowembed/Program.cs for the actual mechanism (SetParent +
 * stripping the target's own title bar). This component's own job is
 * small: ask main to start it, keep reporting where this container
 * sits on screen so the native window tracks it, and hide the native
 * window while this one is minimized.
 *
 * Known, stated limitation: the embedded window is a real Win32
 * window compositing on top of the whole screen — it will always
 * render above every other Anchoran UI element in the space it
 * occupies (other dragged windows, menus, …), regardless of Anchoran's
 * own on-screen stacking. Fixing that properly needs a real
 * compositor (DirectComposition), which is out of scope here.
 */
export function EmbeddedApp({ windowId, embedPath }: { windowId?: string; embedPath?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"launching" | "embedded" | "error">("launching");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);

  const isMinimized = useWindowStore((s) => s.windows.find((w) => w.windowId === windowId)?.isMinimized ?? false);
  const isFocused = useWindowStore((s) => s.focusedWindowId === windowId);
  const openApp = useWindowStore((s) => s.openApp);
  const closeWindow = useWindowStore((s) => s.closeWindow);

  useEffect(() => {
    if (!embedPath || !windowId || !window.anchoran) return;
    let cancelled = false;
    setStatus("launching");
    window.anchoran.embedStart(windowId, embedPath).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setStatus("error");
        setErrorMessage(result.error ?? "Couldn't start this app.");
      }
    });
    return () => {
      cancelled = true;
      window.anchoran?.embedStop(windowId);
    };
  }, [embedPath, windowId]);

  useEffect(() => {
    if (!windowId) return;
    window.anchoran?.onEmbedStatus((s) => {
      if (s.windowId !== windowId) return;
      if (s.state === "embedded") {
        setStatus("embedded");
        setErrorMessage(null);
      } else if (s.state === "closed") {
        setStatus("error");
        setErrorMessage("This app was closed.");
      } else if (s.state === "error") {
        setStatus("error");
        setErrorMessage(s.message);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowId]);

  // Keep the real window positioned exactly over this container —
  // getBoundingClientRect() is already relative to Anchoran's own
  // BrowserWindow client area, which is exactly the coordinate space
  // SetWindowPos needs once the target has been reparented into it.
  useEffect(() => {
    if (!windowId || status !== "embedded") return;
    let raf = 0;
    let last = "";
    function report() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const key = `${rect.left}|${rect.top}|${rect.width}|${rect.height}`;
        if (key !== last) {
          last = key;
          window.anchoran?.embedBounds(windowId!, rect.left, rect.top, rect.width, rect.height);
        }
      }
      raf = requestAnimationFrame(report);
    }
    raf = requestAnimationFrame(report);
    return () => cancelAnimationFrame(raf);
  }, [windowId, status]);

  useEffect(() => {
    if (!windowId || status !== "embedded") return;
    window.anchoran?.embedVisibility(windowId, !isMinimized);
  }, [windowId, status, isMinimized]);

  useEffect(() => {
    if (!windowId || status !== "embedded" || !isFocused) return;
    window.anchoran?.embedFocus(windowId);
  }, [windowId, status, isFocused]);

  async function onPickExe(result: { path: string } | { dir: string; name: string }) {
    setPicker(false);
    if (!("path" in result) || !windowId) return;
    const name = result.path.slice(Math.max(result.path.lastIndexOf("\\"), result.path.lastIndexOf("/")) + 1);
    closeWindow(windowId);
    openApp("embeddedApp", { embedPath: result.path, title: name });
  }

  if (!embedPath) {
    return (
      <div className="app-root">
        <div className="app-content embeddedapp-empty">
          <p>Choose a Windows app (.exe) to run embedded in this window.</p>
          <button className="app-toolbar-btn" onClick={() => setPicker(true)}>
            Choose an app…
          </button>
        </div>
        {picker && (
          <AnchoranFilePicker
            mode="open"
            title="Choose a Windows app"
            extensions={[".exe"]}
            onConfirm={onPickExe}
            onCancel={() => setPicker(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="embeddedapp-stage">
      {status !== "embedded" && (
        <div className="embeddedapp-overlay">
          {status === "error" ? errorMessage ?? "Couldn't embed this app." : "Starting…"}
        </div>
      )}
    </div>
  );
}
