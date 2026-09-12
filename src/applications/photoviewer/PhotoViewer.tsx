import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./photoviewer.css";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);

interface Photo {
  name: string;
  path: string;
  dataUrl: string;
}

export function PhotoViewerApp({ openPath }: { openPath?: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // A photo opened directly from Files (e.g. from Downloads, not the
  // Pictures folder) — shown standalone since it isn't part of the
  // scanned gallery below.
  const [externalPhoto, setExternalPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    async function load() {
      if (!window.anchoran) {
        setLoading(false);
        return;
      }
      const folders = await window.anchoran.fsSpecialFolders();
      const result = await window.anchoran.fsListDir(folders.pictures);
      if ("error" in result) {
        setLoading(false);
        return;
      }
      const imageFiles = result.entries.filter(
        (e) => !e.isDirectory && IMAGE_EXT.has(e.name.slice(e.name.lastIndexOf(".")).toLowerCase())
      );
      const loaded: Photo[] = [];
      for (const file of imageFiles) {
        const img = await window.anchoran!.fsReadImageFile(file.path);
        if ("dataUrl" in img) loaded.push({ name: file.name, path: file.path, dataUrl: img.dataUrl });
      }
      setPhotos(loaded);
      setLoading(false);

      if (openPath) {
        const indexInGallery = loaded.findIndex((p) => p.path === openPath);
        if (indexInGallery >= 0) {
          setOpenIndex(indexInGallery);
        } else {
          const img = await window.anchoran!.fsReadImageFile(openPath);
          if ("dataUrl" in img) {
            const name = openPath.slice(openPath.lastIndexOf("\\") + 1);
            setExternalPhoto({ name, path: openPath, dataUrl: img.dataUrl });
          }
        }
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPath]);

  if (externalPhoto) {
    return (
      <div className="app-root">
        <div className="app-toolbar">
          <button className="app-toolbar-btn" onClick={() => setExternalPhoto(null)}>
            <Icon name="chevronRight" size={13} style={{ transform: "rotate(180deg)" }} /> Back
          </button>
          <span style={{ fontSize: 12.5 }}>{externalPhoto.name}</span>
        </div>
        <div className="app-content photoviewer-full">
          <img src={externalPhoto.dataUrl} alt={externalPhoto.name} />
        </div>
      </div>
    );
  }

  if (openIndex !== null && photos[openIndex]) {
    const photo = photos[openIndex];
    return (
      <div className="app-root">
        <div className="app-toolbar">
          <button className="app-toolbar-btn" onClick={() => setOpenIndex(null)}>
            <Icon name="chevronRight" size={13} style={{ transform: "rotate(180deg)" }} /> Back
          </button>
          <span style={{ fontSize: 12.5 }}>{photo.name}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className="app-toolbar-btn" disabled={openIndex === 0} onClick={() => setOpenIndex((i) => (i! > 0 ? i! - 1 : i))}>
              Prev
            </button>
            <button
              className="app-toolbar-btn"
              disabled={openIndex === photos.length - 1}
              onClick={() => setOpenIndex((i) => (i! < photos.length - 1 ? i! + 1 : i))}
            >
              Next
            </button>
          </div>
        </div>
        <div className="app-content photoviewer-full">
          <img src={photo.dataUrl} alt={photo.name} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="app-content photoviewer-grid">
        {loading && <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>Loading your Pictures folder…</div>}
        {!loading && photos.length === 0 && (
          <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>
            No images in your Pictures folder yet — create one in Paint, Pixel Art or Wallpaper Maker, or add photos there.
          </div>
        )}
        {photos.map((photo, i) => (
          <div key={photo.path} className="photoviewer-thumb" onClick={() => setOpenIndex(i)}>
            <img src={photo.dataUrl} alt={photo.name} />
            <span>{photo.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
