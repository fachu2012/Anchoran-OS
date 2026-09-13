import { ANCHORAN_VERSION } from "@/core/version";

export type BuildChannel = "stable" | "insider";

/**
 * Whether THIS specific installed binary was built from an Insider
 * Preview Update (I.P.U.) tag or a plain, stable one — not to be
 * confused with the "Insider Preview updates" toggle (which controls
 * whether this device *offers* to install I.P.U. builds going
 * forward).
 *
 * Derived directly from ANCHORAN_VERSION itself: an I.P.U. build's
 * version carries a real semver prerelease suffix (e.g. "3.0.0-IPU")
 * that its later stable release of the same base version doesn't
 * ("3.0.0") — the release workflow's "Set I.P.U. version suffix" step
 * bakes that into version.json right before building. That real
 * semver difference is what makes electron-updater's own comparison
 * correctly treat the stable release as newer and actually offer it,
 * instead of the two versions comparing as equal and silently
 * stranding an Insider Preview device on that build forever (see the
 * README's versioning section) — the version string doing double duty
 * as both "what to compare" and "which channel this is" is the whole
 * point, not an earlier, separate build-time marker file.
 */
export const BUILD_CHANNEL: BuildChannel = /-ipu/i.test(ANCHORAN_VERSION) ? "insider" : "stable";
