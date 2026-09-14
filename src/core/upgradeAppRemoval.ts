import { compareVersions } from "@/core/buildNumber";
import { LEGACY_APP_IDS, type LegacyAppInfo } from "@/core/legacyAppIds";

/**
 * The version this migration shipped in — the "Local Apps" removal
 * warning fires for an update crossing this boundary, the exact
 * symmetric counterpart to `needsDataWipeFor`'s v2.9.2 boundary in
 * buildNumber.ts (that one gates an old-version downgrade behind a
 * mandatory wipe; this one gates a forward update behind an
 * informational notice instead — nothing here blocks the install).
 */
export const APP_REMOVAL_VERSION = "3.4.0";

/**
 * Whether updating *from* `previousVersion` *to* `targetVersion`
 * crosses the app-removal boundary — the running device predates it
 * and the update actually reaches or passes it. `targetVersion`
 * defaults to `APP_REMOVAL_VERSION` itself so a caller that only has
 * "what version am I on right now" (the common case — see
 * UpdateReadyScreen, which already knows its own target separately)
 * can still call this with just one argument.
 */
export function crossesAppRemoval(previousVersion: string, targetVersion: string = APP_REMOVAL_VERSION): boolean {
  return compareVersions(previousVersion, APP_REMOVAL_VERSION) < 0 && compareVersions(targetVersion, APP_REMOVAL_VERSION) >= 0;
}

/** Every legacy app (from LEGACY_APP_IDS) actually present in this device's installed-apps list — the ones the warning should name. Order follows LEGACY_APP_IDS, not `installedIds`, for a stable, predictable list. */
export function installedLegacyApps(installedIds: Iterable<string>): LegacyAppInfo[] {
  const installed = new Set(installedIds);
  return LEGACY_APP_IDS.filter((app) => installed.has(app.id));
}

/**
 * Whether the "Anchoran Local Apps" removal notice should be shown for
 * this update: only when the device is crossing the boundary AND it
 * actually has at least one of the removed apps installed — an
 * up-to-date device, or one that never installed any of them, sees
 * nothing at all, exactly as specified.
 */
export function needsLocalAppsRemovalNotice(
  previousVersion: string,
  installedIds: Iterable<string>,
  targetVersion?: string
): boolean {
  return crossesAppRemoval(previousVersion, targetVersion) && installedLegacyApps(installedIds).length > 0;
}
