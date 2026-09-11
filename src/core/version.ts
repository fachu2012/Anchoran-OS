import versionFile from "../../version.json";

/**
 * Anchoran's version has a single source of truth: /version.json at
 * the project root. Every place that displays a version (About,
 * Settings, System Monitor, the boot screen, the Terminal's
 * `anchoran version` command) must import it from here rather than
 * hardcoding a string.
 *
 * In the Electron shell the same value is also readable via
 * `window.anchoran.getVersion()`, which reads the identical file on
 * the main-process side — the two are guaranteed to agree because
 * they are the same file.
 */
export const ANCHORAN_VERSION: string = versionFile.version;

export async function getRuntimeVersion(): Promise<string> {
  if (window.anchoran) {
    try {
      return await window.anchoran.getVersion();
    } catch {
      // Fall through to the bundled constant if the bridge is unavailable
      // (e.g. running the renderer standalone in a browser during dev).
    }
  }
  return ANCHORAN_VERSION;
}
