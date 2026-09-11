/**
 * Publishes this version's Anchoran Webstore catalog: a snapshot of
 * every app that exists as of the current version.json version,
 * written to release/webstore-registry.json and attached to the
 * matching GitHub Release by .github/workflows/release.yml.
 *
 * The catalog is naturally cumulative — apps.json only ever gains
 * entries across versions, never loses them — so each release's
 * attached registry is simply "every app that existed up through this
 * version," which is exactly what src/applications/webstoreRegistry.ts
 * fetches at runtime, matched to the currently-running version.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf-8"));
const apps = JSON.parse(fs.readFileSync(path.join(root, "src", "applications", "apps.json"), "utf-8"));

const releaseDir = path.join(root, "release");
fs.mkdirSync(releaseDir, { recursive: true });

const outFile = path.join(releaseDir, "webstore-registry.json");
fs.writeFileSync(outFile, JSON.stringify({ version, apps }, null, 2) + "\n");
console.log(`[generate-webstore-registry] v${version}: ${apps.length} apps -> ${path.relative(root, outFile)}`);
