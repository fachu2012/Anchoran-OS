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

/** v3.0.0 is the newest version that was ever actually released under the old "vX.Y.Z" naming — everything after it only ever existed under the new one. */
const OLD_STYLE_CUTOFF = "3.0.0";

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Whether a *specific* version should be named the old "vX.Y.Z" way —
 * true for v3.0.0 and everything before it, since those genuinely only
 * ever shipped under that naming (renaming them retroactively to
 * "Version # | Build #H#.#" would describe a naming scheme that didn't
 * exist yet when they came out). False for anything after v3.0.0.
 */
export function usesOldVersionStyle(version: string): boolean {
  return compareVersions(version, OLD_STYLE_CUTOFF) <= 0;
}

/**
 * The correct display label for naming one specific, possibly
 * historical, version — e.g. a past entry in the update history, or
 * one of the releases `anchoran changeto` lists — as opposed to
 * ANCHORAN_DISPLAY_VERSION above, which is always for the version
 * currently running. Picks old ("v2.9.7") or new ("Version 3 | Build
 * 3H0.1") style based on when that version actually shipped, and
 * optionally appends " I.P.U." when it's known to be an Insider
 * Preview build rather than a stable one — without that, an update
 * from the v3.0.0 I.P.U. build to the v3.0.0 stable release (an
 * identical version number either way, by design — see the README's
 * versioning section) would otherwise misleadingly read as "v3.0.0 →
 * v3.0.0", as if nothing happened.
 */
export function versionLabelFor(version: string, channel?: "stable" | "insider" | null): string {
  const base = usesOldVersionStyle(version) ? `v${version}` : `Version ${version.split(".")[0]} | Build ${buildNumberFor(version)}`;
  return channel === "insider" ? `${base} I.P.U.` : base;
}
