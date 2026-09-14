/**
 * Fetches the live plugin catalog from the Anchoran-Webstore repo —
 * a separate repo, versioned and released on its own, so a new or
 * updated community app never needs a new Anchoran OS release to
 * exist. Always reads whatever that repo's *latest* release actually
 * is, regardless of which Anchoran OS version is asking — see that
 * repo's own README for the full design and the Anchoran App SDK
 * contract every plugin is built against.
 */
export interface PluginManifest {
  id: string;
  title: string;
  description: string;
  icon: string;
  version: string;
  minAnchoranVersion: string;
  entry: string;
  /** Who publishes this plugin — shown in the Webstore's detail view. Optional: an older catalog entry (or a locally-authored one from Code Studio before it's published) may not set one. */
  author?: string;
}

const REPO = "fachu2012/Anchoran-Webstore";

export async function fetchPluginCatalog(): Promise<{ plugins: PluginManifest[]; sdkVersion: string | null }> {
  try {
    const releaseRes = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!releaseRes.ok) return { plugins: [], sdkVersion: null };
    const release = (await releaseRes.json()) as { assets?: { name: string; browser_download_url: string }[] };
    const asset = release.assets?.find((a) => a.name === "catalog.json");
    if (!asset) return { plugins: [], sdkVersion: null };
    const catalogRes = await fetch(asset.browser_download_url);
    if (!catalogRes.ok) return { plugins: [], sdkVersion: null };
    const data = (await catalogRes.json()) as { sdkVersion?: string; plugins?: PluginManifest[] };
    return { plugins: Array.isArray(data.plugins) ? data.plugins : [], sdkVersion: data.sdkVersion ?? null };
  } catch {
    return { plugins: [], sdkVersion: null };
  }
}
