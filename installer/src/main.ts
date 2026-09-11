import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

/**
 * AnchoranSetup: the branded, fullscreen installer experience.
 *
 * It does NOT reimplement installation itself — it silently drives the
 * real, battle-tested NSIS installer that `npm run dist` produces for
 * AnchoranOS (electron-builder's nsis target, run with the standard
 * `/S` silent flag), and shows a fullscreen Anchoran-branded progress
 * screen in front of it instead of NSIS's own wizard UI. On success it
 * launches AnchoranOS and closes itself.
 *
 * Caveat (documented rather than hidden): NSIS's silent mode does not
 * emit real byte-level progress, so the stage list/progress bar in the
 * renderer is a timed, staged animation rather than a literal progress
 * readout — the same approach most branded custom-installer wrappers
 * use around a silent MSI/NSIS payload.
 */

let win: BrowserWindow | null = null;

function findBundledInstaller(): string | null {
  // In a packaged AnchoranSetup build, the real AnchoranOS installer is
  // bundled as an extraResource (see installer/electron-builder.yml).
  const packagedPath = path.join(process.resourcesPath, "AnchoranOS-Setup.exe");
  if (fs.existsSync(packagedPath)) return packagedPath;

  // Dev-time fallback: look next to this repo's own release/ output.
  const devCandidate = path.join(__dirname, "..", "..", "release");
  if (fs.existsSync(devCandidate)) {
    const match = fs
      .readdirSync(devCandidate)
      .find((f) => f.toLowerCase().endsWith(".exe") && f.toLowerCase().includes("setup"));
    if (match) return path.join(devCandidate, match);
  }
  return null;
}

function likelyInstalledAnchoranPath(): string {
  const localAppData = process.env.LOCALAPPDATA ?? "";
  return path.join(localAppData, "Programs", "Anchoran OS", "AnchoranOS.exe");
}

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#08090D",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

function send(channel: string, ...args: unknown[]) {
  win?.webContents.send(channel, ...args);
}

function runInstall() {
  const installerPath = findBundledInstaller();
  if (!installerPath) {
    send("setup:error", "Could not find the Anchoran OS installer package.");
    return;
  }

  send("setup:stage", "copying");
  const child = spawn(installerPath, ["/S"], { windowsHide: true });

  child.on("error", (err) => {
    send("setup:error", err.message);
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      send("setup:error", `Installer exited with code ${code}.`);
      return;
    }
    send("setup:stage", "configuring");
    setTimeout(() => {
      send("setup:stage", "done");
      setTimeout(() => {
        const exePath = likelyInstalledAnchoranPath();
        if (fs.existsSync(exePath)) {
          spawn(exePath, [], { detached: true, stdio: "ignore" }).unref();
        } else {
          // Installed, but we couldn't confirm the exact exe path (a
          // custom install directory, localized Program Files name,
          // etc). Anchoran OS is on the Start Menu either way — this
          // just means AnchoranSetup can't auto-launch it this time.
          send("setup:launch-fallback");
        }
        setTimeout(() => app.quit(), 600);
      }, 500);
    }, 600);
  });
}

ipcMain.on("setup:ready", () => {
  runInstall();
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => app.quit());
