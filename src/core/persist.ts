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
  // Electron's IPC (structured clone) can't carry functions, class
  // instances, etc. — a value containing any of those (e.g. spreading a
  // Zustand store's full state, action methods included) would
  // otherwise fail to save *silently*, which is exactly what happened
  // with preferencesStore before this guard existed. Round-tripping
  // through JSON both strips anything unclonable and catches the
  // failure loudly instead of losing it.
  let safeValue: unknown;
  try {
    safeValue = JSON.parse(JSON.stringify(value));
  } catch (err) {
    logAnchoranError("persist:serialize", `Could not persist "${bucket}/${key}": ${err}`);
    return;
  }

  const bridge = window.anchoran;
  if (bridge) {
    const write = bucket === "config" ? bridge.configSet(key, safeValue) : bridge.dataSet(key, safeValue);
    write.catch((err) => logAnchoranError("persist:ipc", `Failed to persist "${bucket}/${key}": ${err}`));
    return;
  }
  try {
    localStorage.setItem(`anchoran.${bucket}.${key}`, JSON.stringify(safeValue));
  } catch (err) {
    logAnchoranError("persist:localStorage", `Failed to persist "${bucket}/${key}": ${err}`);
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
