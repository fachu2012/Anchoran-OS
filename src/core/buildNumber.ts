import { ANCHORAN_VERSION } from "@/core/version";

/**
 * The "Version {major} | Build {major}H{minor}.{patch}" display
 * convention that replaced plain "vX.Y.Z" text everywhere a person
 * reads it, starting with v3.0.0 — see the README's versioning
 * section. Git tags, package.json/version.json, download URLs, and
 * every Terminal command that matches a real release (`anchoran
 * changeto`, `anchoran version`, the update/rollback machinery in
 * App.tsx) all keep using real semver forever; this is purely a label
 * for humans, built from the same underlying version.
 */
export function buildNumberFor(version: string): string {
  const [major, minor, patch] = version.split(".");
  return `${major}H${minor}.${patch}`;
}

export const ANCHORAN_MAJOR_VERSION = ANCHORAN_VERSION.split(".")[0];
export const ANCHORAN_BUILD_NUMBER = buildNumberFor(ANCHORAN_VERSION);
/** "Version 3 | Build 3H0.0" — the standard full display string for the version currently running. */
export const ANCHORAN_DISPLAY_VERSION = `Version ${ANCHORAN_MAJOR_VERSION} | Build ${ANCHORAN_BUILD_NUMBER}`;
