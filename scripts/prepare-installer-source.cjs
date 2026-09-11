/**
 * Finds the AnchoranOS NSIS installer that `npm run dist` just built in
 * /release and copies it to a fixed filename, release/AnchoranOS-Setup-source.exe,
 * so installer/electron-builder.yml can bundle it as an extraResource
 * without caring about the version number embedded in its real
 * filename (e.g. "Anchoran OS Setup 1.0.0-alpha.2.exe").
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const releaseDir = path.join(root, "release");
const targetFile = path.join(releaseDir, "AnchoranOS-Setup-source.exe");

if (!fs.existsSync(releaseDir)) {
  console.error("[prepare-installer-source] /release does not exist yet — run `npm run dist` first.");
  process.exit(1);
}

const candidate = fs
  .readdirSync(releaseDir)
  .filter((f) => f.toLowerCase().endsWith(".exe") && f !== "AnchoranOS-Setup-source.exe")
  .map((f) => ({ name: f, mtime: fs.statSync(path.join(releaseDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)[0];

if (!candidate) {
  console.error("[prepare-installer-source] No .exe found in /release — run `npm run dist` first.");
  process.exit(1);
}

fs.copyFileSync(path.join(releaseDir, candidate.name), targetFile);
console.log(`[prepare-installer-source] ${candidate.name} -> ${path.relative(root, targetFile)}`);
