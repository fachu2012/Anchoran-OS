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
    preview:
      "radial-gradient(120% 90% at 18% 8%, rgba(110,155,247,0.20) 0%, rgba(110,155,247,0) 42%), " +
      "linear-gradient(165deg, #05060A 0%, #0C1524 38%, #16233F 68%, #1E3A8A 100%)",
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
  {
    id: "ember",
    name: "Ember",
    preview:
      "radial-gradient(110% 85% at 82% 92%, rgba(180,83,9,0.22) 0%, rgba(180,83,9,0) 45%), " +
      "linear-gradient(165deg, #06070A 0%, #1A1410 42%, #2A1B10 72%, #7C3A0F 100%)",
  },
  {
    id: "verdant",
    name: "Verdant",
    preview:
      "radial-gradient(120% 90% at 20% 90%, rgba(15,118,110,0.22) 0%, rgba(15,118,110,0) 45%), " +
      "linear-gradient(165deg, #05070A 0%, #0B1A18 40%, #0F2B26 70%, #0F766E 100%)",
  },
];

export function getWallpaper(id: string): WallpaperDefinition {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
}
