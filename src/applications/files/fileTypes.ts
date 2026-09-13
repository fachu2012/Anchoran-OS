import type { IconName } from "@/components/Icon";

// Icon-only sets — purely cosmetic, so these can be as broad as real
// file extensions actually in use, even ones Anchoran can't open yet.
// Shared between the file list (Files.tsx) and the Properties dialog
// (FileProperties.tsx) so both pick the same icon and "Type" for a
// given file.
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff", ".tif", ".bmp", ".heic", ".raw", ".cr2", ".nef", ".arw", ".ico", ".icns", ".psd", ".xcf", ".tga", ".iff"]);
const DOC_EXT = new Set([".docx", ".doc", ".odt", ".rtf", ".pages", ".wpd", ".wps", ".dotx", ".md", ".txt", ".log"]);
const PDF_EXT = new Set([".pdf"]);
const SHEET_EXT = new Set([".xlsx", ".xls", ".ods", ".numbers", ".csv", ".xltx"]);
const PRESENTATION_EXT = new Set([".pptx", ".ppt", ".odp", ".key", ".potx"]);
const EBOOK_EXT = new Set([".epub", ".mobi", ".azw3", ".djvu"]);
const EMAIL_EXT = new Set([".msg", ".eml"]);
const VECTOR_EXT = new Set([".svg", ".ai", ".eps", ".cdr", ".indd", ".sketch", ".fig"]);
const MODEL3D_EXT = new Set([".obj", ".fbx", ".stl", ".blend", ".skp", ".3ds"]);
const VIDEO_EXT = new Set([".mp4", ".mkv", ".mov", ".avi", ".wmv", ".flv", ".webm", ".mpeg", ".mpg", ".m4v", ".3gp", ".ts", ".vob", ".ogv", ".rmvb", ".asf", ".divx", ".swf"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".flac", ".m4a", ".aac", ".wma", ".ogg", ".opus", ".mid", ".midi", ".amr", ".aif", ".aiff", ".ape", ".mka", ".mpc", ".ra"]);
const ARCHIVE_EXT = new Set([".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".cab", ".jar", ".wim"]);
const DISK_EXT = new Set([".iso", ".bin", ".cue", ".img", ".vhd", ".vhdx", ".vmdk", ".ova", ".ovf", ".pvm"]);
const EXE_EXT = new Set([".exe", ".msi", ".dmg", ".app", ".apk", ".aab", ".deb", ".rpm", ".dll", ".sys", ".drv", ".com", ".gadget", ".scr", ".efi"]);
const DB_EXT = new Set([".db", ".sqlite", ".sqlite3", ".mdb", ".accdb", ".bak", ".dat", ".gdb", ".nsf", ".frm", ".ibd"]);
const FONT_EXT = new Set([".ttf", ".otf", ".woff", ".woff2", ".eot", ".fnt"]);
const ROM_EXT = new Set([".rom", ".sav", ".pak", ".paks", ".vpk", ".gsa", ".nds", ".gba", ".sfc", ".nes"]);
const CERT_EXT = new Set([".pfx", ".p12", ".crt", ".csr", ".pem", ".pub", ".ppk"]);
const SHORTCUT_EXT = new Set([".lnk", ".url", ".alias"]);
const SUBTITLE_EXT = new Set([".srt", ".ass"]);
const CODE_EXT = new Set([".js", ".ts", ".tsx", ".jsx", ".json", ".xml", ".html", ".htm", ".css", ".py", ".java", ".c", ".cpp", ".cs", ".sh", ".bat", ".ps1", ".rb", ".go", ".rs", ".swift", ".sql", ".yaml", ".yml", ".ini", ".config", ".env", ".sass", ".scss", ".vue", ".asp", ".aspx", ".pl", ".kt", ".dart", ".lua", ".asm", ".h", ".php"]);

/** Whether Files should hand this file to the Code Runner (run it) instead of a text editor (edit it) by default. */
export function isCodeFile(name: string): boolean {
  return CODE_EXT.has(extOf(name));
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

/** Picks a more specific icon by extension where Anchoran has one, falling back to a generic file icon. */
export function iconForFile(name: string): IconName {
  const ext = extOf(name);
  if (IMAGE_EXT.has(ext)) return "photoViewer";
  if (PDF_EXT.has(ext)) return "pdfFile";
  if (PRESENTATION_EXT.has(ext)) return "presentation";
  if (SHEET_EXT.has(ext)) return "spreadsheet";
  if (EBOOK_EXT.has(ext)) return "ebook";
  if (EMAIL_EXT.has(ext)) return "email";
  if (VECTOR_EXT.has(ext)) return "vectorDesign";
  if (MODEL3D_EXT.has(ext)) return "model3d";
  if (VIDEO_EXT.has(ext)) return "videoFile";
  if (AUDIO_EXT.has(ext)) return "audioFile";
  if (ARCHIVE_EXT.has(ext)) return "zipTool";
  if (DISK_EXT.has(ext)) return "diskImage";
  if (EXE_EXT.has(ext)) return "executable";
  if (DB_EXT.has(ext)) return "database";
  if (FONT_EXT.has(ext)) return "fontFile";
  if (ROM_EXT.has(ext)) return "gameRom";
  if (CERT_EXT.has(ext)) return "certificate";
  if (SHORTCUT_EXT.has(ext)) return "shortcut";
  if (SUBTITLE_EXT.has(ext)) return "subtitle";
  if (CODE_EXT.has(ext)) return "jsonFormatter";
  if (DOC_EXT.has(ext)) return "document";
  return "file";
}

/**
 * A human "Type" label for the Properties dialog, grouped the way a
 * user thinks about a file rather than by its exact format — audio
 * and video both read as "Multimedia", every image extension reads as
 * "Image", and so on, instead of every single file just saying "File".
 */
export function typeLabelForFile(name: string): string {
  const ext = extOf(name);
  if (IMAGE_EXT.has(ext)) return "Image";
  if (VIDEO_EXT.has(ext) || AUDIO_EXT.has(ext)) return "Multimedia";
  if (PDF_EXT.has(ext)) return "PDF Document";
  if (PRESENTATION_EXT.has(ext)) return "Presentation";
  if (SHEET_EXT.has(ext)) return "Spreadsheet";
  if (EBOOK_EXT.has(ext)) return "E-book";
  if (EMAIL_EXT.has(ext)) return "Email Message";
  if (VECTOR_EXT.has(ext)) return "Vector Image";
  if (MODEL3D_EXT.has(ext)) return "3D Model";
  if (ARCHIVE_EXT.has(ext)) return "Archive";
  if (DISK_EXT.has(ext)) return "Disk Image";
  if (EXE_EXT.has(ext)) return "Application";
  if (DB_EXT.has(ext)) return "Database";
  if (FONT_EXT.has(ext)) return "Font";
  if (ROM_EXT.has(ext)) return "Game ROM";
  if (CERT_EXT.has(ext)) return "Security Certificate";
  if (SHORTCUT_EXT.has(ext)) return "Shortcut";
  if (SUBTITLE_EXT.has(ext)) return "Subtitle";
  if (CODE_EXT.has(ext)) return "Code File";
  if (DOC_EXT.has(ext)) return "Document";
  return ext ? `${ext.slice(1).toUpperCase()} File` : "File";
}
