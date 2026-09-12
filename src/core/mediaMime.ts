/** Extension -> MIME, for building a data URL out of bytes read via fsReadBinary. */
export const MEDIA_MIME_BY_EXT: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export function mimeForPath(filePath: string): string | null {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return MEDIA_MIME_BY_EXT[ext] ?? null;
}
