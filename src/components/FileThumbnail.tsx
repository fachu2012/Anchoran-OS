import { useEffect, useState } from "react";
import { IconTile } from "@/components/IconTile";
import type { IconName } from "@/components/Icon";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);

function isImageFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXT.has(ext);
}

// Read once per path and kept around for the session — every list/grid
// row for the same file reuses it instead of re-reading the image off
// disk each time the view re-renders or the user scrolls back to it.
const thumbnailCache = new Map<string, string>();

/**
 * Drop-in replacement for <IconTile> wherever a real file/folder entry's
 * icon is shown (Files' icon/list/detail/tree views, AnchoranFilePicker's
 * browser, …): image files get an actual small thumbnail of their own
 * pixels — matching how Windows Explorer renders image icons — instead
 * of the same generic "picture" glyph every image would otherwise
 * share. Falls back to the normal IconTile glyph while the thumbnail is
 * still loading, on read failure, or outside the Electron shell.
 */
export function FileThumbnail({
  name,
  path,
  isDirectory,
  fallbackIcon,
  size,
  glyphScale,
}: {
  name: string;
  path: string;
  isDirectory: boolean;
  fallbackIcon: IconName;
  size: number;
  glyphScale: number;
}) {
  const eligible = !isDirectory && isImageFile(name);
  const [dataUrl, setDataUrl] = useState<string | null>(() => (eligible ? (thumbnailCache.get(path) ?? null) : null));

  useEffect(() => {
    if (!eligible || dataUrl || !window.anchoran) return;
    let cancelled = false;
    window.anchoran.fsReadImageFile(path).then((result) => {
      if (cancelled || !("dataUrl" in result)) return;
      thumbnailCache.set(path, result.dataUrl);
      setDataUrl(result.dataUrl);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, path]);

  if (eligible && dataUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          overflow: "hidden",
          flexShrink: 0,
          background: "#0002",
        }}
      >
        <img src={dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }

  return <IconTile name={isDirectory ? "folder" : fallbackIcon} size={size} glyphScale={glyphScale} />;
}
