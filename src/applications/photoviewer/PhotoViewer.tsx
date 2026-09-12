import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./photoviewer.css";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);

interface Photo {
  name: string;
  path: string;
  dataUrl: string;
}

/** Renders the source image rotated by the given multiple of 90° into a same-orientation-corrected data URL — used so "Set as wallpaper" bakes in the rotation instead of ignoring it. */
function rotateDataUrl(dataUrl: string, degrees: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (degrees % 360 === 0) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const swap = degrees % 180 !== 0;
      canvas.width = swap ? img.height : img.width;
      canvas.height = swap ? img.width : img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function PhotoFullView({
  photo,
  onBack,
  onPrev,
  onNext,
}: {
  photo: Photo;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [rotation, setRotation] = useState(0);
  const setCustomWallpaper = usePreferencesStore((s) => s.setCustomWallpaper);
  const setWallpaper = usePreferencesStore((s) => s.setWallpaper);
  const pushNotification = useNotificationStore((s) => s.push);

  useEffect(() => setRotation(0), [photo.path]);

  async function setAsWallpaper() {
    const rotated = await rotateDataUrl(photo.dataUrl, rotation);
    setCustomWallpaper(rotated);
    setWallpaper("custom");
    pushNotification("Photo Viewer", "Applied as your desktop wallpaper.");
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={onBack}>
          <Icon name="chevronRight" size={13} style={{ transform: "rotate(180deg)" }} /> Back
        </button>
        <span style={{ fontSize: 12.5 }}>{photo.name}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button className="app-toolbar-btn" onClick={() => setRotation((r) => (r + 270) % 360)} aria-label="Rotate left">
            <Icon name="restart" size={13} style={{ transform: "scaleX(-1)" }} />
          </button>
          <button className="app-toolbar-btn" onClick={() => setRotation((r) => (r + 90) % 360)} aria-label="Rotate right">
            <Icon name="restart" size={13} />
          </button>
          <button className="app-toolbar-btn" onClick={setAsWallpaper}>
            Set as wallpaper
          </button>
          {onPrev && (
            <button className="app-toolbar-btn" onClick={onPrev}>
              Prev
            </button>
          )}
          {onNext && (
            <button className="app-toolbar-btn" onClick={onNext}>
              Next
            </button>
          )}
        </div>
      </div>
      <div className="app-content photoviewer-full">
        <img src={photo.dataUrl} alt={photo.name} style={{ transform: `rotate(${rotation}deg)` }} />
      </div>
    </div>
  );
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
    return <PhotoFullView photo={externalPhoto} onBack={() => setExternalPhoto(null)} />;
  }

  if (openIndex !== null && photos[openIndex]) {
    return (
      <PhotoFullView
        photo={photos[openIndex]}
        onBack={() => setOpenIndex(null)}
        onPrev={openIndex > 0 ? () => setOpenIndex((i) => i! - 1) : undefined}
        onNext={openIndex < photos.length - 1 ? () => setOpenIndex((i) => i! + 1) : undefined}
      />
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
