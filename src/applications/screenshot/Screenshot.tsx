import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { saveGeneratedFile } from "@/core/saveGenerated";
import { useNotificationStore } from "@/notifications/notificationStore";
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

async function captureSourceToDataUrl(sourceId: string): Promise<string> {
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
  return canvas.toDataURL("image/png");
}

export function ScreenshotApp() {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pushNotification = useNotificationStore((s) => s.push);

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
      const dataUrl = await captureSourceToDataUrl(sourceId);
      setCaptured(dataUrl);
      setSources(null);
    } catch {
      setError("Couldn't capture the screen.");
    }
  }

  async function saveToFiles() {
    if (!captured) return;
    const result = await saveGeneratedFile("picture", `Screenshot ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.png`, captured);
    pushNotification("Screenshot", "error" in result ? result.error : "Saved to Pictures.");
    setCaptured(null);
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={startCapture}>
          <Icon name="screenshot" size={14} /> Capture
        </button>
        {captured && (
          <button className="app-toolbar-btn" onClick={saveToFiles}>
            Save to Files
          </button>
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
          <div className="screenshot-hint">Click Capture to take a screenshot.</div>
        )}
      </div>
    </div>
  );
}
