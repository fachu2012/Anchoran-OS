import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { saveGeneratedFile } from "@/core/saveGenerated";
import { useNotificationStore } from "@/notifications/notificationStore";
import { useWindowStore } from "@/windowmanager/windowStore";
import "@/applications/apps.css";
import "./screenshot.css";

interface Source {
  id: string;
  name: string;
  thumbnailDataUrl: string;
}

/** Electron's chromeMediaSource constraints aren't in the standard DOM types. */
interface ElectronMediaConstraints {
  audio: false;
  video: {
    mandatory: {
      chromeMediaSource: "desktop";
      chromeMediaSourceId: string;
    };
  };
}

/** Captures a source into a canvas (not yet encoded to PNG) — cheap to crop from directly for region selection. */
async function captureSourceToCanvas(sourceId: string): Promise<HTMLCanvasElement> {
  const constraints: ElectronMediaConstraints = {
    audio: false,
    video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: sourceId } },
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints as unknown as MediaStreamConstraints);
  const video = document.createElement("video");
  video.srcObject = stream;
  await video.play();
  await new Promise((r) => setTimeout(r, 200));
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")!.drawImage(video, 0, 0);
  stream.getTracks().forEach((t) => t.stop());
  return canvas;
}

/** A full-screen drag-to-select overlay over a frozen snapshot — rendered via a portal so it truly covers the whole desktop, not just Screenshot's own window. */
function RegionSelector({
  snapshotUrl,
  onSelect,
  onCancel,
}: {
  snapshotUrl: string;
  onSelect: (rect: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const rect =
    start && current
      ? {
          x: Math.min(start.x, current.x),
          y: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        }
      : null;

  return createPortal(
    <div
      className="screenshot-region-overlay"
      style={{ backgroundImage: `url(${snapshotUrl})` }}
      onMouseDown={(e) => {
        setStart({ x: e.clientX, y: e.clientY });
        setCurrent({ x: e.clientX, y: e.clientY });
      }}
      onMouseMove={(e) => start && setCurrent({ x: e.clientX, y: e.clientY })}
      onMouseUp={() => {
        if (rect && rect.width > 4 && rect.height > 4) onSelect(rect);
        else {
          setStart(null);
          setCurrent(null);
        }
      }}
    >
      {rect && (
        <div className="screenshot-region-box" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} />
      )}
      <div className="screenshot-region-hint">Drag to select an area — Esc to cancel</div>
    </div>,
    document.body
  );
}

export function ScreenshotApp() {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<{ canvas: HTMLCanvasElement; snapshotUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const pushNotification = useNotificationStore((s) => s.push);
  const windows = useWindowStore((s) => s.windows);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);

  // Triggered by App.tsx when the global PrintScreen / Ctrl+Shift+S
  // shortcut opens this app — starts the capture immediately instead
  // of making the user click Capture right after it opens.
  useEffect(() => {
    function onAutoCapture() {
      startCapture();
    }
    window.addEventListener("anchoran-auto-capture", onAutoCapture);
    return () => window.removeEventListener("anchoran-auto-capture", onAutoCapture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Screenshot's own window would otherwise show up inside every
  // screenshot it takes, since Anchoran itself is what's on screen —
  // this hides it for the moment of the actual capture and brings it
  // back right after, whether that succeeds or fails.
  async function withWindowHidden<T>(fn: () => Promise<T>): Promise<T> {
    const win = windows.find((w) => w.appId === "screenshot" && !w.isMinimized);
    if (win) {
      minimizeWindow(win.windowId);
      await new Promise((r) => setTimeout(r, 180));
    }
    try {
      return await fn();
    } finally {
      if (win) restoreWindow(win.windowId);
    }
  }

  async function startCapture() {
    setError(null);
    if (!window.anchoran) {
      setError("Screenshots are only available inside the Anchoran desktop app.");
      return;
    }
    const list = await window.anchoran.getCaptureSources();
    if (list.length === 0) {
      setError("No capturable screens found.");
      return;
    }
    if (list.length === 1) {
      await capture(list[0].id);
    } else {
      setSources(list);
    }
  }

  async function capture(sourceId: string) {
    try {
      const canvas = await withWindowHidden(() => captureSourceToCanvas(sourceId));
      setCaptured(canvas.toDataURL("image/png"));
      setSources(null);
    } catch {
      setError("Couldn't capture the screen.");
    }
  }

  async function startRegionCapture(sourceId: string) {
    try {
      const canvas = await withWindowHidden(() => captureSourceToCanvas(sourceId));
      setSelecting({ canvas, snapshotUrl: canvas.toDataURL("image/png") });
      setSources(null);
    } catch {
      setError("Couldn't capture the screen.");
    }
  }

  function onRegionSelected(rect: { x: number; y: number; width: number; height: number }) {
    if (!selecting) return;
    // The overlay shows the snapshot scaled to the viewport, but the
    // real captured canvas is in true screen pixels (device pixel
    // ratio can differ) — scale the drag rectangle back up to match.
    const scaleX = selecting.canvas.width / window.innerWidth;
    const scaleY = selecting.canvas.height / window.innerHeight;
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = Math.round(rect.width * scaleX);
    cropCanvas.height = Math.round(rect.height * scaleY);
    cropCanvas
      .getContext("2d")!
      .drawImage(
        selecting.canvas,
        rect.x * scaleX,
        rect.y * scaleY,
        rect.width * scaleX,
        rect.height * scaleY,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );
    setCaptured(cropCanvas.toDataURL("image/png"));
    setSelecting(null);
  }

  async function startRegionFlow() {
    setError(null);
    if (!window.anchoran) {
      setError("Screenshots are only available inside the Anchoran desktop app.");
      return;
    }
    const list = await window.anchoran.getCaptureSources();
    if (list.length === 0) {
      setError("No capturable screens found.");
      return;
    }
    await startRegionCapture(list[0].id);
  }

  async function saveToFiles() {
    if (!captured) return;
    const result = await saveGeneratedFile("picture", `Screenshot ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.png`, captured);
    pushNotification("Screenshot", "error" in result ? result.error : "Saved to Pictures.");
    setCaptured(null);
  }

  async function copyToClipboard() {
    if (!captured || !window.anchoran) return;
    const result = await window.anchoran.copyImageToClipboard(captured);
    if (result.success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } else {
      pushNotification("Screenshot", result.error ?? "Couldn't copy to clipboard.");
    }
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={startCapture}>
          <Icon name="screenshot" size={14} /> Capture
        </button>
        <button className="app-toolbar-btn" onClick={startRegionFlow}>
          Select area…
        </button>
        {captured && (
          <>
            <button className="app-toolbar-btn" onClick={copyToClipboard}>
              <Icon name="copy" size={13} /> {copied ? "Copied" : "Copy"}
            </button>
            <button className="app-toolbar-btn" onClick={saveToFiles}>
              Save to Files
            </button>
          </>
        )}
      </div>
      <div className="app-content screenshot-content">
        {error && <div className="screenshot-error">{error}</div>}
        {sources && (
          <div className="screenshot-sources">
            {sources.map((s) => (
              <button key={s.id} className="screenshot-source" onClick={() => capture(s.id)}>
                <img src={s.thumbnailDataUrl} alt={s.name} />
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        )}
        {captured && (
          <div className="screenshot-preview">
            <img src={captured} alt="Captured screenshot" />
          </div>
        )}
        {!error && !sources && !captured && (
          <div className="screenshot-hint">Click Capture for the full screen, or Select area… to drag a region.</div>
        )}
      </div>
      {selecting && (
        <RegionSelector
          snapshotUrl={selecting.snapshotUrl}
          onSelect={onRegionSelected}
          onCancel={() => setSelecting(null)}
        />
      )}
    </div>
  );
}
