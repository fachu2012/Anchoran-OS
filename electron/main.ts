import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, screen, session, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFile, spawn } from "node:child_process";
import Store from "electron-store";
import { autoUpdater } from "electron-updater";

const isDev = process.env.ANCHORAN_DEV === "1";

// Chromium's default autoplay policy blocks any audio (including a
// synthesized Web Audio API tone) from starting until a real user
// gesture has happened in that page. Anchoran's boot chime plays
// automatically at the end of the boot sequence — no click precedes
// it — so without this switch it was being silently blocked, and the
// AudioContext it created stayed suspended, which could keep later
// sounds (notifications, errors) silent too. Must be set before the
// app is ready.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

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
const cacheDir = path.join(dataRoot, "cache");
for (const dir of [configDir, dataDir, logsDir, cacheDir]) {
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
 * Ctrl+Alt+L is registered as a reliable, always-available fallback for
 * opening the Launcher — a combination that doesn't touch the Windows
 * key at all, so it avoids that whole class of OS-reserved collision.
 * (Two earlier choices were tried and dropped for exactly that reason:
 * Ctrl+Space frequently collides with Windows' own input-method/
 * keyboard-layout switch hotkey, and Ctrl+Win — despite not being the
 * bare Windows key — turned out to still be claimed by Windows itself
 * on some machines, e.g. for Ink Workspace/accessibility shortcuts.)
 * The Launcher is always one click away from the dock and system bar
 * regardless of any shortcut. Anchoran never disables or intercepts
 * Windows' own critical shortcuts (Ctrl+Alt+Del, Task Manager,
 * sign-out, etc.) and never modifies system security policy.
 */
function registerGlobalShortcuts() {
  const superRegistered = globalShortcut.register("Super", () => {
    mainWindow?.webContents.send("anchoran:toggle-launcher");
  });

  const fallbackRegistered = globalShortcut.register("CommandOrControl+Alt+L", () => {
    mainWindow?.webContents.send("anchoran:toggle-launcher");
  });

  if (!superRegistered) {
    logToDisk(
      "main:shortcuts",
      "Could not bind the Windows key as a global shortcut (Windows itself usually owns it)."
    );
  }
  if (!fallbackRegistered) {
    logToDisk("main:shortcuts", "Could not register the Ctrl+Alt+L fallback shortcut either.");
  }

  // Surface this to the user instead of only logging it silently — if
  // the Windows key AND the fallback both failed to register, the only
  // way left to open the Launcher is the dock/taskbar, which the user
  // should know.
  mainWindow?.webContents.once("did-finish-load", () => {
    mainWindow?.webContents.send("anchoran:shortcut-status", { superRegistered, fallbackRegistered });
  });
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

/**
 * "Print" for apps that produce a document (Notes, JSON Formatter,
 * text files in Files, …): the renderer builds an actual PDF client
 * side (jsPDF), hands it here as base64, and this writes it to
 * Anchoran's own cache folder and opens it with whatever the user's
 * real Windows PDF viewer is — the same as double-clicking a PDF in
 * Explorer. Nothing about the file's origin is hidden from that viewer;
 * it's a real, disposable file on disk, just not one Anchoran keeps
 * track of afterward.
 */
ipcMain.handle("anchoran:save-and-open-file", async (_event, fileName: string, base64: string) => {
  try {
    const safeName = fileName.replace(/[\\/:*?"<>|]/g, "_");
    const filePath = path.join(cacheDir, `${Date.now()}-${safeName}`);
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
    const openError = await shell.openPath(filePath);
    return { success: !openError, error: openError || undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

/**
 * Screenshot app: lists the real capturable screens/windows via
 * Electron's own desktopCapturer — the standard, sanctioned way an
 * Electron app takes a screenshot, no OS-level bypass involved. The
 * renderer takes it from here with `navigator.mediaDevices.getUserMedia`
 * against the chosen source id.
 */
ipcMain.handle("anchoran:get-capture-sources", async () => {
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 320, height: 180 } });
  return sources.map((s) => ({ id: s.id, name: s.name, thumbnailDataUrl: s.thumbnail.toDataURL() }));
});

/** Event Viewer: reads Anchoran's own real log file (see logToDisk above) — the same events it has always written, just made visible. */
ipcMain.handle("anchoran:read-log", () => {
  try {
    const content = fs.readFileSync(logFile, "utf-8");
    return content.split("\n").filter(Boolean).slice(-500).reverse();
  } catch {
    return [];
  }
});

ipcMain.handle("anchoran:reset-data", () => {
  configStore.clear();
  dataStore.clear();
  return true;
});

// The Browser app's <webview> has no `partition` set, so it uses the
// app's default session — this is what lets a single listener here
// catch every download it triggers.
const DOWNLOAD_TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".csv", ".log", ".js", ".ts", ".css", ".html", ".xml", ".yml", ".yaml",
]);

function interceptWebviewDownloads() {
  session.defaultSession.on("will-download", (_event, item) => {
    // Redirected into Anchoran's own cache folder instead of Windows'
    // real Downloads folder, and instead of the native "Save As" dialog
    // — the file then gets imported into Anchoran's own virtual
    // filesystem (Files → Downloads) below, the same as a drag-and-drop
    // import, so it never actually lives in a Windows-visible folder.
    const tempName = `${Date.now()}-${item.getFilename()}`;
    const tempPath = path.join(cacheDir, tempName);
    item.setSavePath(tempPath);

    item.once("done", (_doneEvent, state) => {
      if (state !== "completed") {
        fs.rm(tempPath, { force: true }, () => {});
        return;
      }
      const fileName = item.getFilename();
      const ext = path.extname(fileName).toLowerCase();
      const isText = DOWNLOAD_TEXT_EXTENSIONS.has(ext);
      let content = "";
      try {
        if (isText) content = fs.readFileSync(tempPath, "utf-8");
      } catch {
        // Falls through with empty content — still records the download.
      }
      mainWindow?.webContents.send("anchoran:download-imported", { fileName, content, isText });
      fs.rm(tempPath, { force: true }, () => {});
    });
  });
}

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
};

/**
 * Shared "import an image from Windows" dialog — used wherever
 * Anchoran needs a real photo from the user's own files (wallpapers,
 * the account avatar during onboarding, etc.) rather than one of its
 * own code-generated assets. Returns a data URL so the renderer can
 * use/persist it directly with no further IPC round-trip.
 */
ipcMain.handle("anchoran:import-image", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import Image",
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  const mime = IMAGE_MIME_BY_EXT[ext];
  if (!mime) return null;

  const buffer = fs.readFileSync(filePath);
  // A generous but bounded cap — this ends up base64-encoded inside a
  // JSON preferences file, so an unbounded photo would bloat it badly.
  if (buffer.byteLength > 8 * 1024 * 1024) {
    return { error: "Image is too large (max 8MB)." };
  }
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  return { dataUrl, fileName: path.basename(filePath) };
});

const MEDIA_MIME_BY_EXT: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/** Same idea as import-image, for the Media Player app — audio/video instead of a photo. */
ipcMain.handle("anchoran:import-media", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import Media",
    filters: [{ name: "Audio & Video", extensions: ["mp3", "wav", "ogg", "m4a", "mp4", "webm"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  const mime = MEDIA_MIME_BY_EXT[ext];
  if (!mime) return null;

  const buffer = fs.readFileSync(filePath);
  if (buffer.byteLength > 30 * 1024 * 1024) {
    return { error: "File is too large (max 30MB)." };
  }
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  return { dataUrl, fileName: path.basename(filePath) };
});

/** Zip Tool: lets the user pick a real .zip from Windows to import — unzipping itself happens in the renderer via JSZip. */
ipcMain.handle("anchoran:pick-zip-file", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import Zip",
    filters: [{ name: "Zip archives", extensions: ["zip"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const buffer = fs.readFileSync(filePath);
  if (buffer.byteLength > 50 * 1024 * 1024) {
    return { error: "Zip file is too large (max 50MB)." };
  }
  return { base64: buffer.toString("base64"), fileName: path.basename(filePath) };
});

/**
 * Kiosk Mode: makes Anchoran the Windows shell for the CURRENT USER
 * ACCOUNT ONLY, by writing the per-user Winlogon "Shell" value under
 * HKEY_CURRENT_USER — the same key Windows itself reads at sign-in to
 * decide what to launch instead of explorer.exe. This is a standard,
 * documented Windows configuration point (used by real kiosk-mode
 * deployments), needs no admin rights (HKCU is user-writable), touches
 * nothing about Windows' own boot process, kernel, or recovery tools
 * (Safe Mode, Ctrl+Alt+Del, Task Manager, System Restore all keep
 * working exactly as before), and only ever affects the single
 * Windows account it was turned on for. It takes effect on the NEXT
 * sign-in, never immediately, and can be turned off the same way at
 * any time — plus "Open Windows Desktop" below always provides an
 * immediate way back into Explorer without touching the registry at
 * all, so the user is never without an escape hatch.
 */
const WINLOGON_KEY = "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon";

function runReg(args: string[]): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    execFile("reg.exe", args, (err, stdout, stderr) => {
      resolve({ success: !err, output: err ? stderr || String(err) : stdout });
    });
  });
}

ipcMain.handle("anchoran:get-kiosk-shell-status", async () => {
  const { success, output } = await runReg(["query", WINLOGON_KEY, "/v", "Shell"]);
  if (!success) return { enabled: false, supported: process.platform === "win32" };
  const enabled = output.toLowerCase().includes(path.basename(process.execPath).toLowerCase()) && app.isPackaged;
  return { enabled, supported: process.platform === "win32" };
});

ipcMain.handle("anchoran:set-kiosk-shell", async (_event, enabled: boolean) => {
  if (process.platform !== "win32") return { success: false, error: "Only supported on Windows." };
  if (enabled && !app.isPackaged) {
    return { success: false, error: "Only available in an installed build, not a dev run." };
  }
  const target = enabled ? process.execPath : "explorer.exe";
  const { success, output } = await runReg(["add", WINLOGON_KEY, "/v", "Shell", "/t", "REG_SZ", "/d", target, "/f"]);
  return success ? { success: true } : { success: false, error: output };
});

/** Always-available escape hatch: opens a normal Explorer window immediately, regardless of the Shell registry setting or when it takes effect. */
ipcMain.on("anchoran:open-windows-desktop", () => {
  if (process.platform === "win32") spawn("explorer.exe", [], { detached: true }).unref();
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

/**
 * A silent NSIS install (see quitAndInstall below) genuinely has
 * nothing Anchoran-side can show on screen — the process has to quit
 * for the installer to overwrite its own files, so there's an
 * unavoidable gap with no UI while it runs. This flag survives that
 * gap (written to disk right before quitting) so the *next* boot knows
 * to say "Finishing update…" instead of the generic startup sequence —
 * turning the silent gap into a legible "this was an update completing"
 * story instead of an unexplained pause.
 */
let pendingUpdateVersion: string | null = null;

ipcMain.handle("anchoran:consume-pending-update", () => {
  const version = configStore.get("pendingUpdateVersion") as string | undefined;
  if (version) configStore.delete("pendingUpdateVersion");
  return version ?? null;
});

autoUpdater.on("checking-for-update", () => sendUpdateStatus({ state: "checking" }));
autoUpdater.on("update-available", (info) => sendUpdateStatus({ state: "available", version: info.version }));
autoUpdater.on("update-not-available", () => sendUpdateStatus({ state: "not-available" }));
autoUpdater.on("download-progress", (p) => sendUpdateStatus({ state: "downloading", percent: Math.round(p.percent) }));
autoUpdater.on("update-downloaded", (info) => {
  pendingUpdateVersion = info.version;
  sendUpdateStatus({ state: "downloaded", version: info.version });
});
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
  if (pendingUpdateVersion) configStore.set("pendingUpdateVersion", pendingUpdateVersion);
  // quitAndInstall() with no arguments defaults to isSilent=false, which
  // re-shows the full NSIS wizard instead of the seamless "Restart &
  // Update" experience Anchoran's UI promises — isSilent=true runs the
  // installer with /S, isForceRunAfter=true makes sure AnchoranOS
  // relaunches afterward even though this app isn't built with NSIS's
  // own "run after finish" option checked.
  autoUpdater.quitAndInstall(true, true);
});

/**
 * System Mode: an opt-in toggle (off by default every launch — never
 * persisted as "was on", see src/desktop/systemModeStore.ts) that
 * spawns native/kioskhook's compiled helper so Anchoran can claim the
 * Windows key and Alt+Tab while it's running, without touching
 * anything about how Windows itself starts, logs in, or what happens
 * to whatever the user had open before launching Anchoran — see
 * TODO.md and native/kioskhook/Program.cs for the full design and
 * safety notes. This block only ever manages that one child process:
 * starting it, relaying its two possible stdout lines ("WIN" /
 * "ALTTAB") to the renderer, and making sure it is always stopped —
 * on an explicit toggle-off, and unconditionally on every path out of
 * the app (quit, crash, window-all-closed) — since Windows only
 * regains normal key handling once this process is gone.
 */
let kioskHookProcess: ReturnType<typeof spawn> | null = null;

function kioskHookExePath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "AnchoranKioskHook.exe")
    : path.join(__dirname, "..", "native", "kioskhook", "bin", "Release", "net8.0", "win-x64", "publish", "AnchoranKioskHook.exe");
}

function stopKioskHook() {
  if (!kioskHookProcess) return;
  try {
    kioskHookProcess.stdin?.write("EXIT\n");
  } catch {
    // Falls through to a hard kill below regardless.
  }
  const proc = kioskHookProcess;
  kioskHookProcess = null;
  // Give it a moment to exit cleanly (releasing the hook) before
  // forcing it, so a slow shutdown never leaves the hook installed.
  setTimeout(() => {
    if (!proc.killed) proc.kill();
  }, 1500);
}

ipcMain.handle("anchoran:system-mode-start", () => {
  if (process.platform !== "win32") return { success: false, error: "Only supported on Windows." };
  if (kioskHookProcess) return { success: true };

  const exePath = kioskHookExePath();
  if (!fs.existsSync(exePath)) {
    return {
      success: false,
      error: isDev
        ? "Run `npm run build:kioskhook` first — it isn't built automatically in dev mode."
        : "The System Mode helper is missing from this build.",
    };
  }

  try {
    const child = spawn(exePath, [String(process.pid)]);
    kioskHookProcess = child;

    child.stdout.setEncoding("utf-8");
    let buffer = "";
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line === "WIN" || line === "ALTTAB") {
          mainWindow?.webContents.send("anchoran:system-mode-key", line);
        }
      }
    });

    child.on("exit", () => {
      if (kioskHookProcess === child) kioskHookProcess = null;
      mainWindow?.webContents.send("anchoran:system-mode-status", false);
    });
    child.on("error", (err) => {
      logToDisk("system-mode", `Helper process error: ${err.message}`);
      if (kioskHookProcess === child) kioskHookProcess = null;
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("anchoran:system-mode-stop", () => {
  stopKioskHook();
  return { success: true };
});

ipcMain.handle("anchoran:system-mode-status", () => ({
  running: kioskHookProcess !== null,
  supported: process.platform === "win32",
}));

app.whenReady().then(() => {
  createMainWindow();
  registerGlobalShortcuts();
  interceptWebviewDownloads();
  setInterval(sampleCpuUsage, 1000);
  if (!isDev) {
    autoUpdater.checkForUpdates().catch((err) => {
      logToDisk("updater", `Startup update check failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopKioskHook();
});

app.on("window-all-closed", () => {
  app.quit();
});
