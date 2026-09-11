/**
 * Anchoran's default wallpapers are generated entirely from CSS
 * gradients rather than raster placeholders — this was approved as
 * "generable por código" in the asset inventory, and gives a clean,
 * on-brand background with no improvised imagery. Photographic /
 * illustrated wallpapers can be added later as real image files
 * without changing this registry's shape.
 */
export interface WallpaperDefinition {
  id: string;
  name: string;
  preview: string; // CSS background value, used for both preview and full wallpaper
}

export const WALLPAPERS: WallpaperDefinition[] = [
  {
    id: "default",
    name: "Anchoran Deep",
    preview: "linear-gradient(160deg, #0B1220 0%, #16233F 45%, #1E3A8A 100%)",
  },
  {
    id: "slate",
    name: "Slate",
    preview: "linear-gradient(160deg, #1B1F27 0%, #2A303C 100%)",
  },
  {
    id: "dawn",
    name: "Dawn",
    preview: "linear-gradient(160deg, #E8ECF3 0%, #C9D6EC 55%, #A9BEE6 100%)",
  },
  {
    id: "mist",
    name: "Mist",
    preview: "linear-gradient(160deg, #F4F5F7 0%, #E3E7ED 100%)",
  },
];

export function getWallpaper(id: string): WallpaperDefinition {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
}
