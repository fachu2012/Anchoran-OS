/**
 * Single source of truth for Anchoran OS's version is /version.json.
 * This script propagates that version into package.json (which
 * electron-builder and npm read) so nobody ever edits a version
 * number by hand in more than one place.
 *
 * Run automatically before dev/build via npm scripts.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const versionFile = path.join(root, "version.json");
const packageFile = path.join(root, "package.json");

const { version } = JSON.parse(fs.readFileSync(versionFile, "utf-8"));

if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`[sync-version] "${version}" is not a valid SemVer version.`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packageFile, "utf-8"));
if (pkg.version !== version) {
  pkg.version = version;
  fs.writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`[sync-version] package.json synced to ${version}`);
} else {
  console.log(`[sync-version] already at ${version}`);
}
