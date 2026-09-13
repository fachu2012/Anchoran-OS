import { ANCHORAN_VERSION } from "@/core/version";

/**
 * Strips a real semver prerelease suffix (e.g. "3.0.0-IPU" -> "3.0.0")
 * so the rest of this file can do plain major.minor.patch arithmetic
 * regardless of whether `version` came from an Insider Preview build.
 * See BUILD_CHANNEL in buildChannel.ts for why that suffix exists at
 * all — it's not decorative, it's what makes electron-updater actually
 * recognize a stable release as newer than the I.P.U. build of the
 * same base version, instead of comparing them as equal.
 */
export function baseVersion(version: string): string {
  return version.split("-")[0];
}

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
  const [major, minor, patch] = baseVersion(version).split(".");
  return `${major}H${minor}.${patch}`;
}

export const ANCHORAN_MAJOR_VERSION = baseVersion(ANCHORAN_VERSION).split(".")[0];
export const ANCHORAN_BUILD_NUMBER = buildNumberFor(ANCHORAN_VERSION);
/** "Version 3 | Build 3H0.0" — the standard full display string for the version currently running. */
export const ANCHORAN_DISPLAY_VERSION = `Version ${ANCHORAN_MAJOR_VERSION} | Build ${ANCHORAN_BUILD_NUMBER}`;

/** v3.0.0 is the newest version that was ever actually released under the old "vX.Y.Z" naming — everything after it only ever existed under the new one. */
const OLD_STYLE_CUTOFF = "3.0.0";

function compareVersions(a: string, b: string): number {
  const pa = baseVersion(a).split(".").map(Number);
  const pb = baseVersion(b).split(".").map(Number);
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
 * historical, version — e.g. a past entry in the update history, one
 * of the releases `anchoran changeto` lists, or an update being
 * offered/installed — as opposed to ANCHORAN_DISPLAY_VERSION above,
 * which is always for the version currently running. Picks old
 * ("v2.9.7") or new ("Version 3 | Build 3H0.1") style based on when
 * that version actually shipped, and appends " I.P.U." for an Insider
 * Preview build rather than a stable one — e.g. distinguishing the
 * v3.0.0 I.P.U. build from the v3.0.0 stable release, an update
 * history transition that would otherwise misleadingly read as
 * "v3.0.0 → v3.0.0", as if nothing happened. Defaults to reading the
 * channel straight off `version`'s own "-IPU" suffix when `channel`
 * isn't passed explicitly, since that suffix is real (see
 * buildChannel.ts) — most callers naming a specific version string
 * (already-suffixed if it's an I.P.U. one) don't need to track the
 * channel separately just to pass it in here.
 */
export function versionLabelFor(version: string, channel?: "stable" | "insider" | null): string {
  const resolvedChannel = channel ?? (/-ipu/i.test(version) ? "insider" : "stable");
  const major = baseVersion(version).split(".")[0];
  const base = usesOldVersionStyle(version) ? `v${baseVersion(version)}` : `Version ${major} | Build ${buildNumberFor(version)}`;
  return resolvedChannel === "insider" ? `${base} I.P.U.` : base;
}

/**
 * Same idea as versionLabelFor, but compact — drops the "Version # | "
 * part for a new-style version, leaving just "Build #H#.#[ I.P.U.]".
 * Used where every entry is already understood to be an Anchoran OS
 * release and repeating "Version 3 | " on each line (`anchoran
 * changeto`'s list) would just be noise old-style entries don't have
 * an equivalent of anyway.
 */
export function shortLabelFor(version: string, channel?: "stable" | "insider" | null): string {
  const resolvedChannel = channel ?? (/-ipu/i.test(version) ? "insider" : "stable");
  const base = usesOldVersionStyle(version) ? `v${baseVersion(version)}` : `Build ${buildNumberFor(version)}`;
  return resolvedChannel === "insider" ? `${base} I.P.U.` : base;
}

/**
 * Resolves what a person typed at `anchoran changeto` against the real
 * list of installable release tags. Accepts the exact tag as-is
 * (however it's spelled — "3.0.3", "v3.0.3", "3.0.3-IPU", "v3.0.3-
 * IPU"), or — for a new-style version — its short build number alone
 * ("3H0.3"), optionally followed by "-IPU"/" I.P.U." (any spacing/case)
 * to specifically target the Insider Preview build rather than its
 * stable counterpart when both exist under the same build number. A
 * bare build number with no I.P.U. marker prefers the stable release
 * when one exists for that build number, falling back to the I.P.U.
 * one when that's the only release with it (e.g. before the stable cut
 * has shipped yet).
 */
export function resolveVersionTarget(
  input: string,
  releases: { tag: string; isIPU: boolean }[]
): string | null {
  const raw = input.trim();
  const strippedV = raw.replace(/^v/i, "");
  const exact = releases.find((r) => r.tag === raw || r.tag === strippedV);
  if (exact) return exact.tag;

  const buildMatch = raw.match(/^(\d+)H(\d+)\.(\d+)\s*(-?\s*I\.?\s*P\.?\s*U\.?)?$/i);
  if (!buildMatch) return null;
  const wantedBuild = `${buildMatch[1]}H${buildMatch[2]}.${buildMatch[3]}`;
  const wantsIPU = !!buildMatch[4];
  const candidates = releases.filter((r) => buildNumberFor(r.tag) === wantedBuild);
  const stable = candidates.find((r) => !r.isIPU);
  const insider = candidates.find((r) => r.isIPU);
  return wantsIPU ? (insider?.tag ?? null) : (stable?.tag ?? insider?.tag ?? null);
}
