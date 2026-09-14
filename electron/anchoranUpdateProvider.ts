/**
 * A fixed GitHub update provider for electron-updater — the real
 * built-in `GitHubProvider`'s own "which release is next?" logic
 * (node_modules/electron-updater/out/providers/GitHubProvider.js,
 * `getLatestVersion()`) only ever recognizes a NEXT prerelease
 * candidate whose channel name (from `semver.prerelease(tag)[0]`)
 * matches the CURRENTLY RUNNING build's channel name EXACTLY
 * (`hrefChannel === currentChannel`). Anchoran's git tags always
 * literally say `-IPU` (a deliberate, permanent convention — see the
 * `ipu-two-stage-release-process` notes) while the internal
 * `version.json`/build version string says `-beta` (needed so
 * electron-updater treats it as a walkable prerelease channel at
 * all — see the v3.1.2 fix). So `currentChannel` is always `"beta"`
 * and `hrefChannel` for any Anchoran I.P.U. is always `"IPU"` — they
 * can never match, which means from any I.P.U. build, the stock
 * provider can only ever detect the next STABLE release, never a
 * newer I.P.U. one.
 *
 * Anchoran only ever publishes ONE prerelease naming scheme (every
 * prerelease tag says `-IPU`, nothing else), so there's no real
 * ambiguity to resolve here: while running any prerelease build,
 * ANY prerelease tag found in the feed (not just one whose channel
 * name happens to equal the current one) is a legitimate "next
 * I.P.U." candidate. That's the ONE line this subclass changes —
 * everything else (fetching the Atom feed, the stable-release
 * fallback, resolving the actual download files) is copied unchanged
 * from the real GitHubProvider, so behavior for a stable-channel
 * install (allowPrerelease off) is completely untouched.
 */
// Deliberately resolved from electron-updater's OWN nested copy of
// builder-util-runtime (not this project's root-level one) — two
// different versions of that package are installed (root pins an
// older one some other dependency needs; electron-updater carries its
// own newer copy), and TypeScript treats their classes as nominally
// distinct types (private fields make structural typing fail) even
// though they're "the same" package. Provider.js's own methods
// (httpRequest, executor.request, …) were compiled against ITS
// nested copy, so this file has to use that exact same one too, or
// every call into them fails to typecheck.
import { CancellationToken, HttpError, newError, parseXml, githubUrl, type GithubOptions, type ReleaseNoteInfo, type XElement, type UpdateFileInfo } from "electron-updater/node_modules/builder-util-runtime";
import { URL } from "url";
import type { AppUpdater } from "electron-updater/out/AppUpdater";
import type { ResolvedUpdateFileInfo } from "electron-updater/out/types";
import { Provider, parseUpdateInfo, resolveFiles as resolveProviderFiles, type ProviderRuntimeOptions } from "electron-updater/out/providers/Provider";
import { newUrlFromBase, getChannelFilename } from "electron-updater/out/util";

// No @types/semver in this project (electron-updater carries its own
// nested copy it never re-exports types for) — a small inline shape
// covering exactly the 2 functions used below is simpler than adding
// a new dependency just for this.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const semver = require("semver") as {
  valid: (v: string) => string | null;
  prerelease: (v: string) => string[] | null;
};

interface AnchoranUpdateInfo {
  tag: string;
  version: string;
  path: string;
  sha512: string;
  files: UpdateFileInfo[];
  releaseName?: string | null;
  releaseNotes?: string | Array<ReleaseNoteInfo> | null;
  releaseDate: string;
  [key: string]: unknown;
}

const hrefRegExp = /\/tag\/(v?[^/]+)$/;

function newBaseUrl(url: string): URL {
  const result = new URL(url);
  if (!result.pathname.endsWith("/")) result.pathname += "/";
  return result;
}

export class AnchoranGitHubProvider extends Provider<AnchoranUpdateInfo> {
  private readonly baseUrl: URL;

  constructor(
    private readonly options: GithubOptions,
    private readonly updater: AppUpdater,
    runtimeOptions: ProviderRuntimeOptions
  ) {
    super({ ...runtimeOptions, isUseMultipleRangeRequest: false });
    this.baseUrl = newBaseUrl(githubUrl(options, "github.com"));
  }

  private get basePath(): string {
    return `/${this.options.owner}/${this.options.repo}/releases`;
  }

  private getBaseDownloadPath(tag: string, fileName: string): string {
    return `${this.basePath}/download/${tag}/${fileName}`;
  }

  private get channel(): string {
    const result = this.updater.channel || this.options.channel;
    return result == null ? this.getDefaultChannelName() : this.getCustomChannelName(result);
  }

  async getLatestVersion(): Promise<AnchoranUpdateInfo> {
    const cancellationToken = new CancellationToken();
    const feedXml = (await this.httpRequest(
      newUrlFromBase(`${this.basePath}.atom`, this.baseUrl),
      { accept: "application/xml, application/atom+xml, text/xml, */*" },
      cancellationToken
    )) as string;
    const feed = parseXml(feedXml);
    let latestRelease: XElement = feed.element("entry", false, "No published versions on GitHub");
    let tag: string | null = null;

    try {
      if (this.updater.allowPrerelease) {
        const currentChannel = this.updater.channel || semver.prerelease(this.updater.currentVersion.raw)?.[0] || null;
        if (currentChannel === null) {
          // Same as stock: a genuinely stable current build with
          // allowPrerelease on just takes the newest feed entry,
          // whatever channel it is.
          const href = feed.element("entry", false, "").element("link").attribute("href");
          tag = hrefRegExp.exec(href)?.[1] ?? null;
        } else {
          for (const element of feed.getElements("entry")) {
            const hrefElement = hrefRegExp.exec(element.element("link").attribute("href"));
            if (hrefElement === null) continue;
            const hrefTag = hrefElement[1];
            if (!semver.valid(hrefTag)) continue;
            const hrefChannel = semver.prerelease(hrefTag)?.[0] || null;
            const shouldFetchVersion = !currentChannel || ["alpha", "beta"].includes(currentChannel);
            const isCustomChannel = hrefChannel !== null && !["alpha", "beta"].includes(String(hrefChannel));
            const channelMismatch = currentChannel === "beta" && hrefChannel === "alpha";
            if (shouldFetchVersion && !isCustomChannel && !channelMismatch) {
              tag = hrefTag;
              latestRelease = element;
              break;
            }
            // THE FIX: the stock provider requires
            // `hrefChannel === currentChannel` here — a string-exact
            // match against the tag's OWN channel name ("IPU") vs the
            // internal build's channel name ("beta"), which never
            // matches for Anchoran's naming scheme (see this file's
            // header). Anchoran only ever has one prerelease scheme,
            // so ANY prerelease tag found while running a prerelease
            // build is a legitimate next-I.P.U. candidate.
            const isNextPreRelease = hrefChannel !== null;
            if (isNextPreRelease) {
              tag = hrefTag;
              latestRelease = element;
              break;
            }
          }
        }
      } else {
        tag = await this.getLatestTagName(cancellationToken);
        for (const element of feed.getElements("entry")) {
          const hrefMatch = hrefRegExp.exec(element.element("link").attribute("href"));
          if (hrefMatch == null) continue;
          if (hrefMatch[1] === tag) {
            latestRelease = element;
            break;
          }
        }
      }
    } catch (e) {
      const err = e as Error;
      throw newError(`Cannot parse releases feed: ${err.stack || err.message},\nXML:\n${feedXml}`, "ERR_UPDATER_INVALID_RELEASE_FEED");
    }

    if (tag == null) {
      throw newError("No published versions on GitHub", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
    }

    let rawData: string | null;
    let channelFile = "";
    let channelFileUrl: URL = this.baseUrl;
    const fetchData = async (channelName: string) => {
      channelFile = getChannelFilename(channelName);
      channelFileUrl = newUrlFromBase(this.getBaseDownloadPath(String(tag), channelFile), this.baseUrl);
      const requestOptions = this.createRequestOptions(channelFileUrl);
      try {
        return await this.executor.request(requestOptions, cancellationToken);
      } catch (e) {
        if (e instanceof HttpError && e.statusCode === 404) {
          throw newError(`Cannot find ${channelFile} in the latest release artifacts (${channelFileUrl}): ${(e as Error).stack || (e as Error).message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
        }
        throw e;
      }
    };

    try {
      let channel = this.channel;
      const tagPrerelease = semver.prerelease(tag)?.[0];
      if (this.updater.allowPrerelease && tagPrerelease) {
        channel = this.getCustomChannelName(String(tagPrerelease));
      }
      rawData = await fetchData(channel);
    } catch (e) {
      if (this.updater.allowPrerelease) {
        rawData = await fetchData(this.getDefaultChannelName());
      } else {
        throw e;
      }
    }

    const result = parseUpdateInfo(rawData, channelFile, channelFileUrl) as AnchoranUpdateInfo;
    if (result.releaseName == null) result.releaseName = latestRelease.elementValueOrEmpty("title");
    return { ...result, tag };
  }

  private async getLatestTagName(cancellationToken: CancellationToken): Promise<string | null> {
    const url = newUrlFromBase(`${this.basePath}/latest`, this.baseUrl);
    try {
      const rawData = await this.httpRequest(url, { Accept: "application/json" }, cancellationToken);
      if (rawData == null) return null;
      const releaseInfo = JSON.parse(rawData) as { tag_name: string };
      return releaseInfo.tag_name;
    } catch (e) {
      const err = e as Error;
      throw newError(`Unable to find latest version on GitHub (${url}), please ensure a production release exists: ${err.stack || err.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }

  resolveFiles(updateInfo: AnchoranUpdateInfo): Array<ResolvedUpdateFileInfo> {
    return resolveProviderFiles(updateInfo, this.baseUrl, (p) => this.getBaseDownloadPath(updateInfo.tag, p.replace(/ /g, "-")));
  }
}
