import { usePreferencesStore } from "@/theme/preferencesStore";
import { getWallpaper } from "./wallpapers";

export function Wallpaper() {
  const wallpaperId = usePreferencesStore((s) => s.wallpaperId);
  const wallpaper = getWallpaper(wallpaperId);
  return <div className="desktop-wallpaper" style={{ background: wallpaper.preview }} />;
}
