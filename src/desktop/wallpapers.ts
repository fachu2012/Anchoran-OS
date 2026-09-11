/**
 * Anchoran's default wallpapers. Most are real generated images
 * (assets/wallpapers/*.png); "Mist" stays a plain CSS gradient since it
 * has no matching commissioned image yet. `preview` is a CSS
 * `background` value used directly for both the desktop wallpaper and
 * its picker swatch in Settings/Onboarding — a plain gradient and a
 * `url(...) center/cover` image both work as drop-in values here.
 */
const DEFAULT_IMG = new URL("../../assets/wallpapers/default.png", import.meta.url).href;
const SLATE_IMG = new URL("../../assets/wallpapers/slate.png", import.meta.url).href;
const DAWN_IMG = new URL("../../assets/wallpapers/dawn.png", import.meta.url).href;
const EMBER_IMG = new URL("../../assets/wallpapers/ember.png", import.meta.url).href;
const VERDANT_IMG = new URL("../../assets/wallpapers/verdant.png", import.meta.url).href;

export interface WallpaperDefinition {
  id: string;
  name: string;
  preview: string; // CSS background value, used for both preview and full wallpaper
}

export const WALLPAPERS: WallpaperDefinition[] = [
  {
    id: "default",
    name: "Anchoran Deep",
    preview: `url(${DEFAULT_IMG}) center/cover no-repeat`,
  },
  {
    id: "slate",
    name: "Slate",
    preview: `url(${SLATE_IMG}) center/cover no-repeat`,
  },
  {
    id: "dawn",
    name: "Dawn",
    preview: `url(${DAWN_IMG}) center/cover no-repeat`,
  },
  {
    id: "mist",
    name: "Mist",
    preview: "linear-gradient(160deg, #F4F5F7 0%, #E3E7ED 100%)",
  },
  {
    id: "ember",
    name: "Ember",
    preview: `url(${EMBER_IMG}) center/cover no-repeat`,
  },
  {
    id: "verdant",
    name: "Verdant",
    preview: `url(${VERDANT_IMG}) center/cover no-repeat`,
  },
];

export function getWallpaper(id: string): WallpaperDefinition {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
}
