/**
 * Anchoran's persistence layer. In the real Electron shell this reads
 * and writes to Anchoran's own on-disk stores (see electron/main.ts —
 * `config/` for preferences, `data/` for the virtual filesystem, both
 * under Anchoran's app-scoped folder, entirely separate from Windows
 * files). When the renderer runs standalone (e.g. `vite dev` opened in
 * a plain browser tab without Electron), it falls back to
 * localStorage so the UI still works during that kind of preview.
 *
 * "config" and "data" are two independent buckets on disk, matching
 * the architecture's separation between settings/preferences and the
 * virtual filesystem's contents.
 */
export type PersistBucket = "config" | "data";

export async function persistGet<T>(bucket: PersistBucket, key: string, fallback: T): Promise<T> {
  const bridge = window.anchoran;
  if (bridge) {
    try {
      const value = bucket === "config" ? await bridge.configGet(key) : await bridge.dataGet(key);
      return value === undefined ? fallback : (value as T);
    } catch {
      return fallback;
    }
  }
  try {
    const raw = localStorage.getItem(`anchoran.${bucket}.${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function persistSet(bucket: PersistBucket, key: string, value: unknown): void {
  const bridge = window.anchoran;
  if (bridge) {
    if (bucket === "config") bridge.configSet(key, value);
    else bridge.dataSet(key, value);
    return;
  }
  try {
    localStorage.setItem(`anchoran.${bucket}.${key}`, JSON.stringify(value));
  } catch {
    // Best-effort persistence only.
  }
}

/**
 * Sends a renderer-side error to Anchoran's own log file on disk
 * (electron/main.ts writes it under the app's logs/ folder). Falls
 * back to the devtools console when the Electron bridge isn't present.
 */
export function logAnchoranError(scope: string, error: unknown): void {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  if (window.anchoran) {
    window.anchoran.logError(scope, message);
  } else {
    console.error(`[Anchoran:${scope}]`, message);
  }
}
