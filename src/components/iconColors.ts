import type { IconName } from "./Icon";

/**
 * Every icon in Anchoran is drawn as a monochrome stroke glyph (see
 * Icon.tsx) that inherits the surrounding text color — on its own,
 * that means every app and every file type renders as the exact same
 * plain white/gray line art, with nothing but the shape to tell them
 * apart. IconTile.tsx fixes that by giving each icon its own solid
 * color tile to sit on, so apps and files are recognizable by color
 * at a glance, the way a real desktop's icons are.
 *
 * File-type and a handful of flagship system icons are hand-picked to
 * match real-world conventions (folders are amber, PDFs are red, zips
 * are orange, …) since those matter most for scanning a file list at
 * speed. Every other icon — the ~70 Webstore apps — gets a color
 * deterministically derived from its own name, spread across the full
 * hue wheel, so it's stable across sessions and near-certain to differ
 * from its neighbors without hand-picking dozens of one-off colors.
 */
const CURATED: Partial<Record<IconName, string>> = {
  // Files & file types
  folder: "#F2B341",
  file: "#8B96A5",
  files: "#F2B341",
  document: "#3E7BFA",
  pdfFile: "#E5484D",
  presentation: "#F76B15",
  spreadsheet: "#2FA86A",
  ebook: "#8E4EC6",
  email: "#3E7BFA",
  vectorDesign: "#D6409F",
  model3d: "#6E56CF",
  videoFile: "#E5479B",
  audioFile: "#30A46C",
  zipTool: "#F5A524",
  diskImage: "#6E7787",
  executable: "#5B5BD6",
  database: "#4763E4",
  fontFile: "#946800",
  gameRom: "#DE3163",
  certificate: "#2A9D8F",
  shortcut: "#8B96A5",
  subtitle: "#7C7C7C",
  photoViewer: "#B54EE0",
  recycleBin: "#6E7787",

  // Flagship system apps
  terminal: "#1F2933",
  settings: "#6E7787",
  browser: "#3E7BFA",
  systemMonitor: "#2FA86A",
  appCenter: "#D6409F",
  calculator: "#F5A524",
  notes: "#F2B341",
  mediaPlayer: "#E5479B",
};

/** Stable, evenly-spread palette hues so hashed colors don't cluster around a few tones. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function iconColor(name: IconName): string {
  const curated = CURATED[name];
  if (curated) return curated;
  const hue = hashString(name) % 360;
  return `hsl(${hue}, 62%, 47%)`;
}
