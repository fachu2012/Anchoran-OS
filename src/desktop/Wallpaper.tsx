import { usePreferencesStore } from "@/theme/preferencesStore";
import { getWallpaper } from "./wallpapers";

export function Wallpaper() {
  const wallpaperId = usePreferencesStore((s) => s.wallpaperId);
  const customWallpaperDataUrl = usePreferencesStore((s) => s.customWallpaperDataUrl);

  if (wallpaperId === "custom" && customWallpaperDataUrl) {
    return (
      <div
        className="desktop-wallpaper"
        style={{
          backgroundImage: `url(${customWallpaperDataUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    );
  }

  const wallpaper = getWallpaper(wallpaperId);
  return <div className="desktop-wallpaper" style={{ background: wallpaper.preview }} />;
}
