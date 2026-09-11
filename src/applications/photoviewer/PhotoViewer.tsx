import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { useFsStore, TRASH_ID } from "@/filesystem/fs";
import "@/applications/apps.css";
import "./photoviewer.css";

export function PhotoViewerApp() {
  const nodes = useFsStore((s) => s.nodes);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const images = useMemo(
    () =>
      Object.values(nodes).filter(
        (n) => n.type === "file" && n.parentId !== TRASH_ID && n.content?.startsWith("data:image")
      ),
    [nodes]
  );

  if (openIndex !== null && images[openIndex]) {
    const img = images[openIndex];
    return (
      <div className="app-root">
        <div className="app-toolbar">
          <button className="app-toolbar-btn" onClick={() => setOpenIndex(null)}>
            <Icon name="chevronRight" size={13} style={{ transform: "rotate(180deg)" }} /> Back
          </button>
          <span style={{ fontSize: 12.5 }}>{img.name}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button
              className="app-toolbar-btn"
              disabled={openIndex === 0}
              onClick={() => setOpenIndex((i) => (i! > 0 ? i! - 1 : i))}
            >
              Prev
            </button>
            <button
              className="app-toolbar-btn"
              disabled={openIndex === images.length - 1}
              onClick={() => setOpenIndex((i) => (i! < images.length - 1 ? i! + 1 : i))}
            >
              Next
            </button>
          </div>
        </div>
        <div className="app-content photoviewer-full">
          <img src={img.content} alt={img.name} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="app-content photoviewer-grid">
        {images.length === 0 && (
          <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>
            No images yet — create one in Paint, Pixel Art or Wallpaper Maker.
          </div>
        )}
        {images.map((img, i) => (
          <div key={img.id} className="photoviewer-thumb" onClick={() => setOpenIndex(i)}>
            <img src={img.content} alt={img.name} />
            <span>{img.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
