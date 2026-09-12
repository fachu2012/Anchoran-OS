import { useEffect, useState } from "react";
import JSZip from "jszip";
import { Icon } from "@/components/Icon";

interface Entry {
  name: string;
  path: string;
  isDirectory: boolean;
}

const PREVIEWABLE_IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const ARCHIVE_PREVIEW_EXT = new Set([".zip"]); // JSZip only understands the zip format itself.

function toFileUrl(filePath: string) {
  return "file:///" + encodeURI(filePath.replace(/\\/g, "/"));
}

/**
 * A real macOS-Quick-Look-style preview, opened with Space on a
 * selected file in Files — a read-only peek, not the full editor
 * "open" flow. Deliberately built on what's already lightweight and
 * available rather than pulling in a heavy dependency for each format:
 * - PDFs render via Chromium's own built-in PDF viewer (Electron ships
 *   it — no pdf.js needed).
 * - SVGs render natively via a plain `<img>` — browsers already do this.
 * - Archives (.zip) list their real contents via JSZip (already a
 *   dependency, used elsewhere) without ever extracting anything to disk.
 * - Text/code shows as plain monospace text — genuine syntax
 *   highlighting would mean shipping Monaco or CodeMirror, real weight
 *   for a read-only peek; skipped for now.
 */
export function QuickLook({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
  const [textContent, setTextContent] = useState<string | null>(null);
  const [archiveEntries, setArchiveEntries] = useState<{ name: string; size: number; dir: boolean }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTextContent(null);
    setArchiveEntries(null);
    setError(null);
    setUnsupported(false);

    async function load() {
      if (!window.anchoran) return;
      if (PREVIEWABLE_IMAGE_EXT.has(ext) || ext === ".svg" || ext === ".pdf") return; // rendered directly below, no fetch needed
      if (ARCHIVE_PREVIEW_EXT.has(ext)) {
        const result = await window.anchoran.fsReadBinary(entry.path);
        if (cancelled) return;
        if ("error" in result) {
          setError(result.error);
          return;
        }
        try {
          const zip = await JSZip.loadAsync(result.base64, { base64: true });
          // JSZip doesn't expose a file's uncompressed size as public
          // API — reading the real bytes via .async() is the
          // documented way to get it, unlike relying on its private
          // internal _data field (which could silently break or read
          // as 0 on a future JSZip version).
          const entries = await Promise.all(
            Object.values(zip.files).map(async (f) => {
              if (f.dir) return { name: f.name, size: 0, dir: true };
              const bytes = await f.async("uint8array");
              return { name: f.name, size: bytes.byteLength, dir: false };
            })
          );
          entries.sort((a, b) => a.name.localeCompare(b.name));
          if (!cancelled) setArchiveEntries(entries);
        } catch {
          if (!cancelled) setError("Couldn't read this archive.");
        }
        return;
      }
      const isText = await window.anchoran.fsIsTextFile(entry.path);
      if (cancelled) return;
      if (!isText) {
        setUnsupported(true);
        return;
      }
      const result = await window.anchoran.fsReadTextFile(entry.path);
      if (cancelled) return;
      if ("content" in result) setTextContent(result.content.slice(0, 200_000));
      else setError(result.error);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [entry.path, ext]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const fileUrl = toFileUrl(entry.path);

  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(90%, 780px)",
          height: "min(85%, 620px)",
          background: "var(--anchoran-surface)",
          borderRadius: "var(--anchoran-radius-lg)",
          boxShadow: "var(--anchoran-shadow-window)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--anchoran-border)" }}>
          <span style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.name}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: "none", background: "transparent", color: "var(--anchoran-text-secondary)", cursor: "pointer" }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: PREVIEWABLE_IMAGE_EXT.has(ext) || ext === ".svg" ? "#111" : undefined }}>
          {PREVIEWABLE_IMAGE_EXT.has(ext) || ext === ".svg" ? (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={fileUrl} alt={entry.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            </div>
          ) : ext === ".pdf" ? (
            <iframe title={entry.name} src={fileUrl} style={{ width: "100%", height: "100%", border: "none" }} />
          ) : error ? (
            <div style={{ padding: 20, fontSize: 12.5, color: "#E5484D" }}>{error}</div>
          ) : archiveEntries ? (
            <div style={{ padding: "8px 4px" }}>
              {archiveEntries.map((e) => (
                <div
                  key={e.name}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "6px 14px",
                    fontSize: 12.5,
                    borderBottom: "1px solid var(--anchoran-border)",
                  }}
                >
                  <Icon name={e.dir ? "folder" : "file"} size={14} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                  {!e.dir && <span style={{ color: "var(--anchoran-text-secondary)" }}>{(e.size / 1024).toFixed(1)} KB</span>}
                </div>
              ))}
              {archiveEntries.length === 0 && (
                <div style={{ padding: 20, fontSize: 12.5, color: "var(--anchoran-text-secondary)" }}>Empty archive.</div>
              )}
            </div>
          ) : unsupported ? (
            <div style={{ padding: 20, fontSize: 12.5, color: "var(--anchoran-text-secondary)" }}>
              No preview available for this file type yet. Press Space or Escape to close.
            </div>
          ) : textContent !== null ? (
            <pre
              style={{
                margin: 0,
                padding: 16,
                fontFamily: "Cascadia Code, Consolas, monospace",
                fontSize: 12.5,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--anchoran-text-primary)",
              }}
            >
              {textContent}
            </pre>
          ) : (
            <div style={{ padding: 20, fontSize: 12.5, color: "var(--anchoran-text-secondary)" }}>Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
}
