import { useEffect, useRef, useState } from "react";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { useFsStore, ROOT_ID } from "@/filesystem/fs";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./wallpapermaker.css";

type Pattern = "gradient" | "radial" | "stripes" | "dots";

const PALETTES: [string, string][] = [
  ["#1E3A8A", "#6E9BF7"],
  ["#0F766E", "#2ECC71"],
  ["#7C3AED", "#EC4899"],
  ["#B45309", "#F5C518"],
  ["#111827", "#374151"],
  ["#DC2626", "#F97316"],
];

function render(ctx: CanvasRenderingContext2D, w: number, h: number, pattern: Pattern, colors: [string, string]) {
  ctx.clearRect(0, 0, w, h);
  if (pattern === "gradient") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (pattern === "radial") {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.2);
    g.addColorStop(0, colors[1]);
    g.addColorStop(1, colors[0]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (pattern === "stripes") {
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = colors[1];
    const stripeWidth = 40;
    for (let x = -h; x < w; x += stripeWidth * 2) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.lineTo(x + h + stripeWidth, h);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else if (pattern === "dots") {
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = colors[1];
    const spacing = 36;
    for (let y = spacing / 2; y < h; y += spacing) {
      for (let x = spacing / 2; x < w; x += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export function WallpaperMakerApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pattern, setPattern] = useState<Pattern>("gradient");
  const [palette, setPalette] = useState<[string, string]>(PALETTES[0]);
  const setCustomWallpaper = usePreferencesStore((s) => s.setCustomWallpaper);
  const createFile = useFsStore((s) => s.createFile);
  const pushNotification = useNotificationStore((s) => s.push);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    render(ctx, canvas.width, canvas.height, pattern, palette);
  }, [pattern, palette]);

  function exportDataUrl() {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    render(ctx, canvas.width, canvas.height, pattern, palette);
    return canvas.toDataURL("image/png");
  }

  function setAsWallpaper() {
    setCustomWallpaper(exportDataUrl());
    pushNotification("Wallpaper Maker", "Applied as your desktop wallpaper.");
  }

  function saveToFiles() {
    createFile(ROOT_ID, `Wallpaper ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.png`, exportDataUrl());
    pushNotification("Wallpaper Maker", "Saved to Files.");
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        {(["gradient", "radial", "stripes", "dots"] as Pattern[]).map((p) => (
          <button key={p} className="app-toolbar-btn" data-op={pattern === p} onClick={() => setPattern(p)}>
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div className="app-content wallpapermaker-content">
        <canvas ref={canvasRef} width={480} height={270} className="wallpapermaker-canvas" />
        <div className="wallpapermaker-palettes">
          {PALETTES.map((p, i) => (
            <button
              key={i}
              className="wallpapermaker-palette-btn"
              data-active={palette[0] === p[0] && palette[1] === p[1]}
              style={{ background: `linear-gradient(135deg, ${p[0]}, ${p[1]})` }}
              onClick={() => setPalette(p)}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="app-toolbar-btn" onClick={setAsWallpaper}>
            Set as wallpaper
          </button>
          <button className="app-toolbar-btn" onClick={saveToFiles}>
            Save to Files
          </button>
        </div>
      </div>
    </div>
  );
}
