import { useRef, useState } from "react";
import { useFsStore, ROOT_ID } from "@/filesystem/fs";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./pixelart.css";

const GRID = 16;
const CELL_PX = 22;
const COLORS = [
  "#14161B", "#FFFFFF", "#E5484D", "#F5A623", "#F5C518",
  "#2ECC71", "#1E9BF0", "#7C3AED", "#EC4899", "#8B5A2B",
];

function emptyGrid(): (string | null)[] {
  return new Array(GRID * GRID).fill(null);
}

export function PixelArtApp() {
  const [pixels, setPixels] = useState<(string | null)[]>(emptyGrid);
  const [color, setColor] = useState(COLORS[0]);
  const [erasing, setErasing] = useState(false);
  const painting = useRef(false);
  const createFile = useFsStore((s) => s.createFile);
  const pushNotification = useNotificationStore((s) => s.push);

  function paint(index: number) {
    setPixels((prev) => {
      const next = [...prev];
      next[index] = erasing ? null : color;
      return next;
    });
  }

  function clearGrid() {
    setPixels(emptyGrid());
  }

  function saveToFiles() {
    const canvas = document.createElement("canvas");
    canvas.width = GRID;
    canvas.height = GRID;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, GRID, GRID);
    pixels.forEach((c, i) => {
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(i % GRID, Math.floor(i / GRID), 1, 1);
    });
    const dataUrl = canvas.toDataURL("image/png");
    createFile(ROOT_ID, `Pixel Art ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.png`, dataUrl);
    pushNotification("Pixel Art", "Saved to Files.");
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" data-op={!erasing} onClick={() => setErasing(false)}>
          Draw
        </button>
        <button className="app-toolbar-btn" data-op={erasing} onClick={() => setErasing(true)}>
          Erase
        </button>
        <button className="app-toolbar-btn" onClick={clearGrid} style={{ marginLeft: "auto" }}>
          Clear
        </button>
        <button className="app-toolbar-btn" onClick={saveToFiles}>
          Save to Files
        </button>
      </div>
      <div className="app-content pixelart-content">
        <div className="pixelart-palette">
          {COLORS.map((c) => (
            <button
              key={c}
              className="pixelart-swatch"
              data-active={color === c && !erasing}
              style={{ background: c }}
              onClick={() => {
                setColor(c);
                setErasing(false);
              }}
            />
          ))}
        </div>
        <div
          className="pixelart-grid"
          style={{ gridTemplateColumns: `repeat(${GRID}, ${CELL_PX}px)` }}
          onPointerDown={() => (painting.current = true)}
          onPointerUp={() => (painting.current = false)}
          onPointerLeave={() => (painting.current = false)}
        >
          {pixels.map((c, i) => (
            <div
              key={i}
              className="pixelart-cell"
              style={{ background: c ?? undefined, width: CELL_PX, height: CELL_PX }}
              onPointerDown={() => paint(i)}
              onPointerEnter={() => painting.current && paint(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
