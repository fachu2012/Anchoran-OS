import { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import Store from "electron-store";
import { autoUpdater } from "electron-updater";

const isDev = process.env.ANCHORAN_DEV === "1";

// version.json is the single source of truth for Anchoran's version.
// It is read once at startup and exposed to the renderer over IPC.
const versionFile = path.join(__dirname, "..", "version.json");
const ANCHORAN_VERSION: string = JSON.parse(fs.readFileSync(versionFile, "utf-8")).version;

/**
 * Anchoran's own data root, entirely separate from Windows/host files
 * (see project architecture rules §18/§23). `userData` is already an
 * app-scoped folder Electron hands us (on Windows, under the current
 * user's AppData) — Anchoran further splits it into config/data/logs
 * so each concern has its own place on disk, mirroring the in-app
 * "Core / FileSystem / Settings" separation.
 */
const dataRoot = app.getPath("userData");
const configDir = path.join(dataRoot, "config");
const dataDir = path.join(dataRoot, "data");
const logsDir = path.join(dataRoot, "logs");
for (const dir of [configDir, dataDir, logsDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

const configStore = new Store({ name: "preferences", cwd: configDir });
const dataStore = new Store({ name: "filesystem", cwd: dataDir });

const logFile = path.join(logsDir, "anchoran.log");
function logToDisk(scope: string, message: string) {
  const line = `[${new Date().toISOString()}] [${scope}] ${message}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch {
    // If we can't write the log itself, there's nothing further we can
    // safely do — swallow rather than crash over logging.
  }
}

process.on("uncaughtException", (err) => {
  logToDisk("main:uncaughtException", err.stack ?? String(err));
});
process.on("unhandledRejection", (reason) => {
  logToDisk("main:unhandledRejection", String(reason));
});

let mainWindow: BrowserWindow | null = null;
let isQuittingConfirmed = false;

/**
 * Anchoran runs as a true fullscreen, frameless, immersive shell.
 * This is a kiosk-style *application window*, not a real OS session:
 * Windows retains ultimate control (Ctrl+Alt+Del, forced shutdown,
 * recovery tools, etc. are never touched — see SECURITY notes below).
 */
function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();

  mainWindow = new BrowserWindow({
    x: primaryDisplay.bounds.x,
    y: primaryDisplay.bounds.y,
    width: primaryDisplay.bounds.width,
    height: primaryDisplay.bounds.height,
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#08090D",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The Browser app uses <webview> instead of <iframe> so sites that
      // refuse to be framed (X-Frame-Options / frame-ancestors) still
      // load — a guest view is a stronger isolation boundary than an
      // iframe (separate process, no direct DOM access to the host
      // page), which is why this is an acceptable trade-off here.
      webviewTag: true,
    },
  });

  mainWindow.removeMenu();

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Anchoran does not use Windows' native title bar close (X). A normal
  // close attempt (Alt+F4, taskbar close, etc.) is intercepted and routed
  // through Anchoran's own "Exit Anchoran?" confirmation instead.
  mainWindow.on("close", (event) => {
    if (!isQuittingConfirmed) {
      event.preventDefault();
      mainWindow?.webContents.send("anchoran:request-exit-confirmation");
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * SECURITY / LIMITATIONS NOTE (see also project instructions §12):
 *
 * Anchoran *attempts* to bind the bare Windows key ("Super") to open its
 * own Launcher via Electron's globalShortcut API, which is the only
 * mechanism an ordinary, non-elevated Windows app has for this. In
 * practice this key is owned by Windows Explorer/the Start Menu at the
 * shell level: `globalShortcut.register("Super", ...)` frequently
 * returns `false` (registration refused) on Windows, and even when it
 * reports success, Windows itself may still intercept the key first and
 * open its own Start Menu, since it isn't a normal hotkey combination.
 * Reliably stealing the bare Windows key away from Explorer would
 * require a low-level system-wide keyboard hook (native Win32 API,
 * outside what Electron exposes) — a heavier, more invasive technique
 * that this project intentionally has not added yet.
 *
 * Ctrl+Space is registered as a reliable, always-available fallback for
 * opening the Launcher, and the Launcher is always one click away from
 * the dock and system bar regardless of either shortcut. Anchoran never
 * disables or intercepts Windows' own critical shortcuts (Ctrl+Alt+Del,
 * Task Manager, sign-out, etc.) and never modifies system security
 * policy.
 */
function registerGlobalShortcuts() {
  const superRegistered = globalShortcut.register("Super", () => {
    mainWindow?.webContents.send("anchoran:toggle-launcher");
  });

  const fallbackRegistered = globalShortcut.register("CommandOrControl+Space", () => {
    mainWindow?.webContents.send("anchoran:toggle-launcher");
  });

  if (!superRegistered) {
    logToDisk(
      "main:shortcuts",
      "Could not bind the Windows key as a global shortcut (Windows itself usually owns it)."
    );
  }
  if (!fallbackRegistered) {
    logToDisk("main:shortcuts", "Could not register the Ctrl+Space fallback shortcut either.");
  }
}

/**
 * Lightweight CPU sampler for the System Monitor app. os.cpus() returns
 * cumulative tick counters, so usage is derived from the delta between
 * two samples rather than a single snapshot; sampling once a second in
 * the background means the IPC handler below can answer instantly with
 * the latest reading instead of blocking on a fresh measurement.
 */
let lastCpuSample = os.cpus();
let cpuUsagePercent = 0;

function sampleCpuUsage() {
  const currentSample = os.cpus();
  let idleDelta = 0;
  let totalDelta = 0;

  for (let i = 0; i < currentSample.length; i++) {
    const prev = lastCpuSample[i].times;
    const curr = currentSample[i].times;
    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;
    totalDelta += currTotal - prevTotal;
    idleDelta += curr.idle - prev.idle;
  }

  cpuUsagePercent = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
  lastCpuSample = currentSample;
}

ipcMain.handle("anchoran:get-version", () => ANCHORAN_VERSION);

ipcMain.handle("anchoran:get-system-info", () => ({
  platform: `${os.platform()} ${os.release()}`,
  arch: os.arch(),
  cpuModel: os.cpus()[0]?.model ?? "Unknown CPU",
  cpuCores: os.cpus().length,
  cpuUsagePercent,
  totalMemMB: Math.round(os.totalmem() / 1048576),
  freeMemMB: Math.round(os.freemem() / 1048576),
  systemUptimeSec: Math.round(os.uptime()),
}));

ipcMain.handle("anchoran:config-get", (_event, key: string) => configStore.get(key));
ipcMain.handle("anchoran:config-set", (_event, key: string, value: unknown) => {
  configStore.set(key, value);
  return true;
});

ipcMain.handle("anchoran:data-get", (_event, key: string) => dataStore.get(key));
ipcMain.handle("anchoran:data-set", (_event, key: string, value: unknown) => {
  dataStore.set(key, value);
  return true;
});

ipcMain.on("anchoran:log-error", (_event, scope: string, message: string) => {
  logToDisk(scope, message);
});

/**
 * Backup / restore / reset for Anchoran's own data (preferences +
 * virtual filesystem — see configStore/dataStore above). Export/import
 * go through native file dialogs in the main process rather than
 * exposing raw filesystem access to the renderer.
 */
ipcMain.handle("anchoran:export-data", async () => {
  if (!mainWindow) return { success: false as const };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Anchoran Data",
    defaultPath: `anchoran-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "Anchoran Backup", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return { success: false as const };

  const payload = {
    anchoranBackup: true,
    version: ANCHORAN_VERSION,
    exportedAt: new Date().toISOString(),
    config: configStore.store,
    data: dataStore.store,
  };
  fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2));
  return { success: true as const, path: result.filePath };
});

ipcMain.handle("anchoran:import-data", async () => {
  if (!mainWindow) return { success: false as const };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import Anchoran Data",
    filters: [{ name: "Anchoran Backup", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false as const };

  try {
    const raw = fs.readFileSync(result.filePaths[0], "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.anchoranBackup) {
      return { success: false as const, error: "This file isn't a valid Anchoran backup." };
    }
    configStore.store = parsed.config ?? {};
    dataStore.store = parsed.data ?? {};
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("anchoran:reset-data", () => {
  configStore.clear();
  dataStore.clear();
  return true;
});

/**
 * Multi-monitor support, phase 1: Anchoran is still a single fullscreen
 * window (see architecture notes — it isn't an independent per-display
 * desktop session yet), but it can be told which connected display to
 * occupy. This exposes the display list and a way to move the window.
 */
ipcMain.handle("anchoran:get-displays", () => {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    label: `${d.bounds.width}×${d.bounds.height}${d.id === primaryId ? " (Primary)" : ""}`,
    isPrimary: d.id === primaryId,
  }));
});

ipcMain.on("anchoran:move-to-display", (_event, displayId: number) => {
  const target = screen.getAllDisplays().find((d) => d.id === displayId);
  if (!target || !mainWindow) return;
  mainWindow.setFullScreen(false);
  mainWindow.setBounds(target.bounds);
  mainWindow.setFullScreen(true);
});

ipcMain.on("anchoran:confirm-exit", () => {
  isQuittingConfirmed = true;
  app.quit();
});

ipcMain.on("anchoran:restart", () => {
  isQuittingConfirmed = true;
  app.relaunch();
  app.quit();
});

/**
 * Auto-update: checks Anchoran's GitHub Releases (see the `publish`
 * block in electron-builder.yml) for a newer build than the one
 * running. Every state change is forwarded to the renderer so the
 * Terminal's `anchoran update` and Settings → About's "Check for
 * updates" can show real progress instead of a canned message.
 */
autoUpdater.logger = {
  info: (m: string) => logToDisk("updater", m),
  warn: (m: string) => logToDisk("updater", m),
  error: (m: string) => logToDisk("updater", m),
  debug: () => {},
};

type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "not-available" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };

function sendUpdateStatus(status: UpdateStatus) {
  mainWindow?.webContents.send("anchoran:update-status", status);
}

autoUpdater.on("checking-for-update", () => sendUpdateStatus({ state: "checking" }));
autoUpdater.on("update-available", (info) => sendUpdateStatus({ state: "available", version: info.version }));
autoUpdater.on("update-not-available", () => sendUpdateStatus({ state: "not-available" }));
autoUpdater.on("download-progress", (p) => sendUpdateStatus({ state: "downloading", percent: Math.round(p.percent) }));
autoUpdater.on("update-downloaded", (info) => sendUpdateStatus({ state: "downloaded", version: info.version }));
autoUpdater.on("error", (err) => sendUpdateStatus({ state: "error", message: err.message }));

ipcMain.handle("anchoran:check-for-updates", () => {
  if (isDev) {
    sendUpdateStatus({ state: "error", message: "Updates are disabled while running in development mode." });
    return;
  }
  autoUpdater.checkForUpdates().catch((err) => {
    sendUpdateStatus({ state: "error", message: err instanceof Error ? err.message : String(err) });
  });
});

ipcMain.on("anchoran:quit-and-install-update", () => {
  isQuittingConfirmed = true;
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  createMainWindow();
  registerGlobalShortcuts();
  setInterval(sampleCpuUsage, 1000);
  if (!isDev) {
    autoUpdater.checkForUpdates().catch((err) => {
      logToDisk("updater", `Startup update check failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  app.quit();
});
