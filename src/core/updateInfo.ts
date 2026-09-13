/**
 * The small, fixed vocabulary of "kinds" an Anchoran OS release can be
 * — set once per version in CHANGELOG.md's own "**Update type:**" line
 * (see the README's versioning section), then baked into that
 * release's `update-info.json` asset by
 * scripts/generate-update-info.cjs at build time. Keeping the
 * vocabulary this small and fixed (rather than free text) is what lets
 * the updater show a clean, professional label instead of whatever a
 * changelog entry happened to say.
 */
export type UpdateTypeKey = "security" | "critical" | "stability" | "feature" | "performance" | "maintenance";

export const UPDATE_TYPE_LABELS: Record<UpdateTypeKey, string> = {
  security: "Security Update",
  critical: "Critical Update",
  stability: "Stability Update",
  feature: "Feature Update",
  performance: "Performance Update",
  maintenance: "Maintenance Update",
};

export function updateTypeLabel(type: string | undefined | null): string | null {
  if (!type) return null;
  return UPDATE_TYPE_LABELS[type as UpdateTypeKey] ?? null;
}

export interface UpdateInfo {
  version: string;
  type: UpdateTypeKey;
  label: string;
}

const REPO = "fachu2012/Anchoran-OS";

/**
 * Fetches the `update-info.json` asset GitHub Actions attaches to the
 * release for a given version (e.g. "2.9.9") — a real Release asset,
 * not a repo file, so it's looked up through the Releases API (the
 * asset list for the tag) rather than raw.githubusercontent.com. Older
 * releases, built before this file existed, simply won't have the
 * asset — this resolves to null rather than throwing, so callers can
 * just not show a type badge for those.
 */
export async function fetchUpdateInfo(version: string): Promise<UpdateInfo | null> {
  try {
    const releaseRes = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/v${version}`);
    if (!releaseRes.ok) return null;
    const release = (await releaseRes.json()) as { assets?: { name: string; browser_download_url: string }[] };
    const asset = release.assets?.find((a) => a.name === "update-info.json");
    if (!asset) return null;
    const infoRes = await fetch(asset.browser_download_url);
    if (!infoRes.ok) return null;
    const info = (await infoRes.json()) as { type?: string };
    const label = updateTypeLabel(info.type);
    if (!label || !info.type) return null;
    return { version, type: info.type as UpdateTypeKey, label };
  } catch {
    return null;
  }
}
