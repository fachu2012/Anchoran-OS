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
 * version carries a real semver prerelease suffix — specifically
 * "-beta" (e.g. "3.0.0-beta"), not "-IPU" as the tag/display name say
 * — that its later stable release of the same base version doesn't
 * ("3.0.0"). The release workflow's "Set I.P.U. version suffix" step
 * bakes that into version.json right before building. "-beta" (rather
 * than a literal "-IPU") is load-bearing: electron-updater's own
 * allowPrerelease logic only recognizes "alpha"/"beta" as prerelease
 * channels it can walk forward from into the next stable release —
 * any other identifier is treated as an unrecognized custom channel
 * that only ever matches another release of that exact same channel,
 * never a stable one, silently stranding a device on that build
 * forever even with updates enabled. See the "Set I.P.U. version
 * suffix" step in .github/workflows/release.yml for the full story.
 * Purely internal: nothing user-facing (the git tag, the release
 * name, "Insider Preview build") reads this string directly.
 */
export const BUILD_CHANNEL: BuildChannel = /-beta/i.test(ANCHORAN_VERSION) ? "insider" : "stable";
