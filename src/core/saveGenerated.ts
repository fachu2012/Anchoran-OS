/**
 * Shared save helper for apps that generate a file (Paint, Pixel Art,
 * Wallpaper Maker, Screenshot, Voice Recorder, Screen Recorder): writes
 * a data URL's real decoded bytes into the appropriate real Windows
 * folder (Pictures for images, Videos/Music for recordings), the same
 * place a real equivalent Windows app would default to.
 */
export type SaveKind = "picture" | "video" | "audio";

export async function saveGeneratedFile(
  kind: SaveKind,
  fileName: string,
  dataUrl: string
): Promise<{ path: string } | { error: string }> {
  if (!window.anchoran) return { error: "Not available outside the Anchoran desktop app." };
  const folders = await window.anchoran.fsSpecialFolders();
  const targetDir = kind === "picture" ? folders.pictures : kind === "video" ? folders.videos : folders.music;
  return window.anchoran.fsWriteDataUrl(targetDir, fileName, dataUrl);
}
