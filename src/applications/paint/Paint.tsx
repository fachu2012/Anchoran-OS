import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useFsStore, ROOT_ID } from "@/filesystem/fs";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./paint.css";

const COLORS = ["#14161B", "#E5484D", "#F5A623", "#F5C518", "#2ECC71", "#1E9BF0", "#7C3AED", "#FFFFFF"];
const SIZES = [2, 4, 8, 16];

export function PaintApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(4);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const createFile = useFsStore((s) => s.createFile);
  const pushNotification = useNotificationStore((s) => s.push);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function getPos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = size;
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function onPointerUp() {
    drawing.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function saveToFiles() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    createFile(ROOT_ID, `Painting ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.png`, dataUrl);
    pushNotification("Paint", "Saved to Files.");
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" data-op={tool === "brush"} onClick={() => setTool("brush")}>
          Brush
        </button>
        <button className="app-toolbar-btn" data-op={tool === "eraser"} onClick={() => setTool("eraser")}>
          Eraser
        </button>
        <div className="paint-sizes">
          {SIZES.map((s) => (
            <button key={s} className="paint-size-btn" data-active={size === s} onClick={() => setSize(s)}>
              <span style={{ width: s, height: s }} />
            </button>
          ))}
        </div>
        <button className="app-toolbar-btn" onClick={clearCanvas} style={{ marginLeft: "auto" }}>
          <Icon name="restart" size={13} /> Clear
        </button>
        <button className="app-toolbar-btn" onClick={saveToFiles}>
          Save to Files
        </button>
      </div>
      <div className="app-content paint-content">
        <div className="paint-palette">
          {COLORS.map((c) => (
            <button
              key={c}
              className="paint-swatch"
              data-active={color === c}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <canvas
          ref={canvasRef}
          width={760}
          height={480}
          className="paint-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
    </div>
  );
}
