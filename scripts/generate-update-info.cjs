/**
 * Generates release/update-info.json — a small, real Release asset
 * (attached by .github/workflows/release.yml alongside the installer)
 * that tells the in-app updater what *kind* of release this is, not
 * just its version number: Security, Critical, Stability, Feature,
 * Performance or Maintenance. See src/core/updateInfo.ts for the fixed
 * vocabulary and how the app reads this file back.
 *
 * The single source of truth for a release's type is a
 * "**Update type:** <word>" line right under that version's own
 * heading in CHANGELOG.md — e.g.:
 *
 *   ## [2.9.9] - 2026-09-13
 *
 *   **Update type:** Stability
 *
 * This script pulls that line out of the current version's changelog
 * section. If it's missing (an older entry, or one someone forgot to
 * annotate), it falls back to "maintenance" with a warning rather than
 * failing the release build — a missing type badge is a lot better
 * than a blocked release.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf-8"));
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf-8");

const VALID_TYPES = ["security", "critical", "stability", "feature", "performance", "maintenance"];

function extractSection(text, ver) {
  const marker = `## [${ver}]`;
  const start = text.indexOf(marker);
  if (start === -1) return null;
  const nextHeading = text.indexOf("\n## [", start + marker.length);
  return text.slice(start, nextHeading === -1 ? undefined : nextHeading);
}

// An I.P.U. build's version.json carries a real semver prerelease
// suffix by the time this script runs (e.g. "3.0.0-IPU" — see the
// release workflow's "Set I.P.U. version suffix" step), but the
// CHANGELOG entry itself is written against the plain base version, so
// look that up rather than the suffixed one. The suffixed `version` is
// still what gets written into update-info.json below, since that's
// what the app's fetchUpdateInfo() looks up by (status.version, which
// electron-updater also reports with the suffix for an I.P.U. release).
const baseVersion = version.split("-")[0];
const section = extractSection(changelog, baseVersion);
let type = "maintenance";

if (!section) {
  console.warn(`[generate-update-info] No CHANGELOG.md section found for v${baseVersion} — defaulting type to "maintenance".`);
} else {
  const match = section.match(/\*\*Update type:\*\*\s*([A-Za-z]+)/);
  if (!match) {
    console.warn(`[generate-update-info] No "**Update type:**" line in the v${baseVersion} CHANGELOG section — defaulting to "maintenance".`);
  } else {
    const found = match[1].toLowerCase();
    if (!VALID_TYPES.includes(found)) {
      console.warn(`[generate-update-info] Unknown update type "${match[1]}" for v${version} — defaulting to "maintenance".`);
    } else {
      type = found;
    }
  }
}

const outDir = path.join(root, "release");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "update-info.json");
fs.writeFileSync(outFile, JSON.stringify({ version, type }, null, 2) + "\n");
console.log(`[generate-update-info] Wrote ${path.relative(root, outFile)} — v${version}, type "${type}".`);
