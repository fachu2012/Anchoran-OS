import type { AppDefinition } from "@/core/types";
import { ANCHORAN_VERSION } from "@/core/version";
import { releaseTagFor } from "@/core/buildNumber";
import { APP_LIST } from "./registry";

const OWNER = "fachu2012";
const REPO = "Anchoran-OS";
const REGISTRY_ASSET_NAME = "webstore-registry.json";

/**
 * The Webstore's catalog is fetched live from the GitHub Release that
 * matches the version currently running — not from a single
 * always-latest file — so a user on an older Anchoran build only ever
 * sees apps that existed as of *their* version, never ones added by a
 * later release they haven't updated to yet (see
 * scripts/generate-webstore-registry.cjs for how each release's
 * catalog snapshot is published).
 *
 * Falls back to the locally-bundled app list — identical to the
 * registry.json shipped in this same build — whenever the network is
 * unavailable, GitHub can't be reached, or this exact version was
 * never tagged as a release (e.g. a local dev build).
 */
export async function fetchWebstoreCatalog(): Promise<{ apps: AppDefinition[]; isRemote: boolean }> {
  try {
    const releaseRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/v${releaseTagFor(ANCHORAN_VERSION)}`
    );
    if (!releaseRes.ok) throw new Error(`Release lookup failed: ${releaseRes.status}`);
    const release = await releaseRes.json();

    const asset = (release.assets as { name: string; browser_download_url: string }[] | undefined)?.find(
      (a) => a.name === REGISTRY_ASSET_NAME
    );
    if (!asset) throw new Error("No webstore-registry.json attached to this release");

    const registryRes = await fetch(asset.browser_download_url);
    if (!registryRes.ok) throw new Error(`Registry download failed: ${registryRes.status}`);
    const registry = (await registryRes.json()) as { version: string; apps: AppDefinition[] };

    if (!Array.isArray(registry.apps) || registry.apps.length === 0) throw new Error("Empty registry");
    return { apps: registry.apps, isRemote: true };
  } catch {
    return { apps: APP_LIST, isRemote: false };
  }
}
