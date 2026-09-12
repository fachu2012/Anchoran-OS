import { useEffect, useRef, useState } from "react";
import "@/applications/apps.css";
import "./magnifier.css";

const ZOOM_LEVELS = [2, 3, 4];

export function MagnifierApp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(document.createElement("video"));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  async function start() {
    setError(null);
    if (!window.anchoran) {
      setError("The Magnifier needs the Anchoran desktop app to capture the screen.");
      return;
    }
    try {
      const sources = await window.anchoran.getCaptureSources();
      if (sources.length === 0) throw new Error("no sources");
      const constraints = {
        audio: false,
        video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: sources[0].id } },
      } as unknown as MediaStreamConstraints;
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setActive(true);
    } catch {
      setError("Couldn't start screen capture.");
    }
  }

  useEffect(() => {
    if (!active) return;
    let raf: number;
    function draw() {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const container = containerRef.current;
      if (canvas && video.videoWidth && container) {
        const ctx = canvas.getContext("2d")!;
        const rect = container.getBoundingClientRect();
        const scaleX = video.videoWidth / window.innerWidth;
        const scaleY = video.videoHeight / window.innerHeight;
        const srcW = (rect.width / zoom) * scaleX;
        const srcH = (rect.height / zoom) * scaleY;
        const srcX = mouse.current.x * scaleX - srcW / 2;
        const srcY = mouse.current.y * scaleY - srcH / 2;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, zoom]);

  useEffect(
    () => () => {
      const stream = videoRef.current.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  // Anchoran itself fills the whole screen, so window-level coordinates
  // already are real desktop coordinates — tracked here instead of on
  // just the lens panel below, so the magnifier keeps following the
  // real cursor anywhere on the desktop (other windows, the taskbar,
  // …), the same as a real magnifier lens, not just while hovering its
  // own small preview area.
  useEffect(() => {
    function onMove(e: MouseEvent) {
      mouse.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="app-root">
      <div className="app-toolbar">
        {!active ? (
          <button className="app-toolbar-btn" onClick={start}>
            Start magnifier
          </button>
        ) : (
          <span style={{ fontSize: 12, color: "var(--anchoran-text-secondary)" }}>
            Move your mouse over the panel below
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {ZOOM_LEVELS.map((z) => (
            <button key={z} className="app-toolbar-btn" data-op={zoom === z} onClick={() => setZoom(z)}>
              {z}x
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="magnifier-stage">
        {error && <div className="magnifier-error">{error}</div>}
        {!active && !error && <div className="magnifier-hint">Click "Start magnifier" to begin.</div>}
        <canvas ref={canvasRef} width={640} height={400} className="magnifier-canvas" />
      </div>
    </div>
  );
}
