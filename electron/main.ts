import { app, BrowserWindow, Menu, clipboard, desktopCapturer, dialog, globalShortcut, ipcMain, nativeImage, safeStorage, screen, session, shell, webContents } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import https from "node:https";
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

// Placeholders — swapped for the real, encrypted stores once the app
// is ready and safeStorage is available (see openEncryptedStore
// below). Nothing reads or writes through these before then, and —
// this is the actual point — they deliberately do NOT point at the
// real "preferences"/"filesystem" files. electron-store's Conf
// constructor reads and JSON.parses whatever's already on disk
// synchronously, immediately, with no encryption key here; once a
// prior session had already encrypted that file for real, every
// subsequent launch hit that same real file with no key and crashed
// on startup, before app.whenReady() (and its own try/catch below)
// ever ran — an actual incident, not a hypothetical. Pointing these
// at a name that's never the real data file sidesteps it entirely.
let configStore = new Store({ name: "preferences-boot-placeholder", cwd: configDir });
let dataStore = new Store({ name: "filesystem-boot-placeholder", cwd: dataDir });

/**
 * Encrypts preferences/filesystem at rest (AES-256-CBC, via
 * electron-store's own encryptionKey option) using a random key that
 * is itself protected by Windows' DPAPI (via Electron's safeStorage),
 * tied to the current Windows user account. Even if someone copies
 * Anchoran's userData folder to another machine or reads it from a
 * different Windows account on a shared PC, the key file alone
 * doesn't decrypt without that same account's DPAPI master key.
 *
 * Existing plaintext stores from before this feature existed are
 * migrated in place, once, on first run — tracked by a small marker
 * file so a later run never mistakes an already-encrypted store for a
 * fresh, unencrypted one (which would otherwise reset it to empty).
 */
function getOrCreateEncryptionKey(): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const keyFile = path.join(dataRoot, ".store.key");
  if (fs.existsSync(keyFile)) {
    try {
      return safeStorage.decryptString(fs.readFileSync(keyFile));
    } catch (err) {
      logToDisk("encryption", `Could not decrypt stored key, regenerating: ${err}`);
    }
  }
  const key = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(keyFile, safeStorage.encryptString(key));
  return key;
}

function openEncryptedStore(name: string, cwd: string, encryptionKey: string | undefined): Store {
  const filePath = path.join(cwd, `${name}.json`);
  const markerFile = path.join(cwd, `.${name}.encrypted`);

  if (!encryptionKey) return new Store({ name, cwd });

  if (fs.existsSync(markerFile)) {
    // Already migrated in an earlier run — safe to open directly. Still
    // never allowed to take the whole app down if this somehow fails
    // anyway (a corrupted or hand-edited file, say): fall back to a
    // fresh encrypted store rather than crashing on every single launch.
    try {
      return new Store({ name, cwd, encryptionKey });
    } catch (err) {
      logToDisk("encryption", `Could not open the encrypted "${name}" store despite being migrated already: ${err}. Starting fresh instead of crashing.`);
      if (fs.existsSync(filePath)) fs.renameSync(filePath, `${filePath}.corrupt-${Date.now()}`);
      return new Store({ name, cwd, encryptionKey });
    }
  }

  // First run with encryption: read any existing PLAINTEXT store first —
  // safe, since no encryptionKey is passed here, so this step never tries
  // to decrypt anything — then move that plaintext file out of the way
  // *before* constructing a Store configured with encryptionKey on the
  // same path. Skipping that move was the actual bug: electron-store's
  // constructor reads whatever's already on disk immediately, so hitting
  // it with an encryptionKey while the file underneath was still plain
  // JSON made it try to AES-decrypt plaintext bytes — which reliably
  // threw a SyntaxError, uncaught, crashing the whole app on every launch
  // (the marker file is only ever written *after* this line, so the
  // exact same crash repeated every single time, with no way back in).
  let existing: Record<string, unknown> = {};
  try {
    existing = new Store({ name, cwd }).store;
  } catch (err) {
    logToDisk("encryption", `No existing plaintext store to migrate for "${name}": ${err}`);
  }
  if (fs.existsSync(filePath)) {
    fs.renameSync(filePath, `${filePath}.pre-encryption-backup`);
  }
  const store = new Store({ name, cwd, encryptionKey });
  if (Object.keys(existing).length > 0) store.store = existing;
  fs.writeFileSync(markerFile, "1");
  return store;
}

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

// Anchoran is a single-instance app: launching it again (double-
// clicking its shortcut repeatedly, running it while it's already
// open, …) used to just stack a brand new fullscreen window on top of
// the running one instead of doing anything useful. requestSingleInstanceLock()
// makes every launch after the first one immediately quit instead —
// second-instance below still runs in the *first* instance so it can
// bring the one real window to the front, matching what a real OS
// does when you try to open it again.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

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
function moveToNextDisplay() {
  if (!mainWindow) return;
  const displays = screen.getAllDisplays();
  if (displays.length < 2) return;
  const current = screen.getDisplayMatching(mainWindow.getBounds());
  const currentIndex = displays.findIndex((d) => d.id === current.id);
  const next = displays[(currentIndex + 1) % displays.length];
  const wasMaximized = mainWindow.isMaximized();
  if (wasMaximized) mainWindow.unmaximize();
  mainWindow.setBounds(next.workArea);
  if (wasMaximized) mainWindow.maximize();
}

function registerGlobalShortcuts() {
  // globalShortcut.register() is documented as returning false when a
  // combination can't be bound, but on some Electron/Windows
  // combinations registering the bare "Super" key instead throws a
  // native TypeError synchronously ("conversion failure from Super")
  // rather than returning false. Uncaught, that throw would abort this
  // whole function — silently skipping the Ctrl+Alt+L fallback below
  // it, and (since this runs inside app.whenReady().then(...)) every
  // other startup step after it too: download interception, CPU
  // sampling, the first update check. Treat a thrown exception exactly
  // like a `false` result instead.
  function tryRegister(accelerator: string): boolean {
    try {
      return globalShortcut.register(accelerator, () => {
        mainWindow?.webContents.send("anchoran:toggle-launcher");
      });
    } catch (err) {
      logToDisk("main:shortcuts", `Registering "${accelerator}" threw instead of failing gracefully: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  const superRegistered = tryRegister("Super");
  const fallbackRegistered = tryRegister("CommandOrControl+Alt+L");

  // Screenshot's own dedicated shortcut — PrintScreen is the real key
  // Windows itself uses for this; Ctrl+Shift+S alongside it since not
  // every keyboard has an easy PrintScreen key (laptops often need Fn).
  try {
    globalShortcut.register("PrintScreen", () => mainWindow?.webContents.send("anchoran:trigger-screenshot"));
    globalShortcut.register("CommandOrControl+Shift+S", () => mainWindow?.webContents.send("anchoran:trigger-screenshot"));
  } catch (err) {
    logToDisk("main:shortcuts", `Registering the screenshot shortcut failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Moves Anchoran's whole window to the next connected physical
  // monitor — Anchoran's own "windows" are virtual, drawn inside this
  // one real Electron window, so this is the one shortcut that
  // legitimately targets a real OS-level display, not a virtual one.
  // A no-op with just one display connected.
  try {
    globalShortcut.register("CommandOrControl+Alt+M", () => moveToNextDisplay());
  } catch (err) {
    logToDisk("main:shortcuts", `Registering the move-to-next-monitor shortcut failed: ${err instanceof Error ? err.message : String(err)}`);
  }

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
  try {
    configStore.set(key, value);
    return true;
  } catch (err) {
    logToDisk("config-set", `Failed to persist "${key}": ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
});

ipcMain.handle("anchoran:data-get", (_event, key: string) => dataStore.get(key));
ipcMain.handle("anchoran:data-set", (_event, key: string, value: unknown) => {
  try {
    dataStore.set(key, value);
    return true;
  } catch (err) {
    logToDisk("data-set", `Failed to persist "${key}": ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
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

/** Screenshot: "Copy" puts the real image bytes on the system clipboard, the same as any real screenshot tool. */
ipcMain.handle("anchoran:copy-image-to-clipboard", (_event, dataUrl: string) => {
  try {
    clipboard.writeImage(nativeImage.createFromDataURL(dataUrl));
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
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

/**
 * Files now browses the real Windows filesystem (see the "Real
 * filesystem" IPC section below), so Browser downloads go straight
 * into the user's actual Downloads folder like any normal browser —
 * no more capturing them into an isolated virtual store first. This
 * picks a non-clashing filename (Windows' own "name (1).ext"
 * convention), lets the download proceed normally to disk, and
 * forwards its whole lifecycle (progress, completion, failure) to the
 * renderer so the Browser app can show a real downloads list instead
 * of downloads happening invisibly in the background.
 */
interface DownloadRecord {
  id: string;
  fileName: string;
  path: string;
  receivedBytes: number;
  totalBytes: number;
  state: "progressing" | "completed" | "cancelled" | "interrupted";
}
let downloadCounter = 0;

function interceptWebviewDownloads() {
  session.defaultSession.on("will-download", (_event, item) => {
    const downloadsDir = app.getPath("downloads");
    const original = item.getFilename();
    const ext = path.extname(original);
    const base = path.basename(original, ext);
    let finalPath = path.join(downloadsDir, original);
    let n = 1;
    while (fs.existsSync(finalPath)) {
      finalPath = path.join(downloadsDir, `${base} (${n})${ext}`);
      n++;
    }
    item.setSavePath(finalPath);

    const id = `dl-${++downloadCounter}`;
    const send = (record: DownloadRecord) => mainWindow?.webContents.send("anchoran:download-update", record);
    send({ id, fileName: path.basename(finalPath), path: finalPath, receivedBytes: 0, totalBytes: item.getTotalBytes(), state: "progressing" });

    item.on("updated", (_e, state) => {
      if (state === "progressing") {
        send({
          id,
          fileName: path.basename(finalPath),
          path: finalPath,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          state: "progressing",
        });
      }
    });
    item.once("done", (_e, state) => {
      send({
        id,
        fileName: path.basename(finalPath),
        path: finalPath,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
        state: state === "completed" ? "completed" : state === "cancelled" ? "cancelled" : "interrupted",
      });
    });
  });
}

/**
 * A small, honest ad/tracker block — a short hardcoded list of the
 * most common ad/analytics domains, not a maintained filter-list
 * subscription. Toggled from Settings; off by default changes nothing
 * about how sites behave.
 */
// A meaningfully broader list than a token gesture — every major ad
// network/exchange and analytics/tracking pixel provider with real
// market share, not just Google's and Meta's own. Still a hostname
// blocklist (fast, simple, no filter-list-parsing engine), paired
// with the cosmetic CSS hiding in Browser.tsx's BrowserTabView for the
// "robust" half real ad blockers also do.
const TRACKER_HOSTS = [
  // Google's ad/analytics stack
  "doubleclick.net", "googlesyndication.com", "googleadservices.com",
  "google-analytics.com", "googletagmanager.com", "googletagservices.com",
  "adservice.google.com", "pagead2.googlesyndication.com",
  // Meta / Facebook
  "facebook.com/tr", "connect.facebook.net",
  // Major ad exchanges/networks
  "adnxs.com", "adsrvr.org", "criteo.com", "rubiconproject.com",
  "openx.net", "pubmatic.com", "casalemedia.com", "contextweb.com",
  "smartadserver.com", "advertising.com", "adform.net", "bidswitch.net",
  "yieldmo.com", "sharethrough.com", "33across.com", "media.net",
  // Amazon / Microsoft ad platforms
  "amazon-adsystem.com", "adsystem.amazon.com", "ads.microsoft.com", "bing.com/ads",
  // Native/content recommendation ("chumbox") networks
  "outbrain.com", "taboola.com", "revcontent.com", "mgid.com",
  // Analytics/tracking pixels beyond Google's own
  "scorecardresearch.com", "quantserve.com", "hotjar.com", "mixpanel.com",
  "segment.io", "segment.com", "amplitude.com", "crazyegg.com",
  "chartbeat.com", "newrelic.com", "bugsnag.com",
];
let trackerBlockEnabled = false;
let trackerBlockedCount = 0;

function setupTrackerBlocking() {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (trackerBlockEnabled && TRACKER_HOSTS.some((host) => details.url.includes(host))) {
      trackerBlockedCount += 1;
      callback({ cancel: true });
    } else {
      callback({ cancel: false });
    }
  });
}

ipcMain.handle("anchoran:set-tracker-block", (_event, enabled: boolean) => {
  trackerBlockEnabled = enabled;
  return { success: true };
});

ipcMain.handle("anchoran:get-tracker-block-count", () => trackerBlockedCount);

/** "Save complete page" — the standard Electron savePage, given a webview's own webContentsId (not the main window's), so it's the actual page shown, not Anchoran's own shell. */
ipcMain.handle(
  "anchoran:save-page-complete",
  async (_event, webContentsId: number, targetDir: string, fileName: string) => {
    try {
      const wc = webContents.fromId(webContentsId);
      if (!wc) return { success: false, error: "That page is no longer open." };
      await wc.savePage(path.join(targetDir, fileName), "HTMLComplete");
      return { success: true, path: path.join(targetDir, fileName) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
);

/**
 * Default browser permission policy — camera/mic/location denied
 * automatically (a webview page has no real UI of its own to ask the
 * user directly), notifications allowed since they're harmless and
 * surface through Anchoran's own notification center instead of a
 * native OS one.
 */
function setupPermissionPolicy() {
  const DENIED_PERMISSIONS = new Set(["camera", "microphone", "geolocation", "media"]);
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(!DENIED_PERMISSIONS.has(permission));
  });
}

/** Browser: fetches an image URL from a page (e.g. right-click → "Set as wallpaper") and returns it as a data URL, since the renderer's webview guest can't be trusted to read cross-origin image bytes itself. */
ipcMain.handle("anchoran:fetch-image-as-data-url", async (_event, url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return { error: `Request failed (${res.status})` };
    const contentType = res.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) return { error: "Not an image." };
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > 15 * 1024 * 1024) return { error: "Image is too large (max 15MB)." };
    return { dataUrl: `data:${contentType};base64,${buffer.toString("base64")}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

/** Browser: lists/manages the downloads tracked this session (Anchoran doesn't persist a download history across restarts, matching what "will-download" above can actually see). */
ipcMain.handle("anchoran:open-download", async (_event, filePath: string) => {
  const err = await shell.openPath(filePath);
  return { success: !err, error: err || undefined };
});
ipcMain.on("anchoran:show-download-in-explorer", (_event, filePath: string) => shell.showItemInFolder(filePath));

/** Browser: "Clear browsing data" — cookies/cache/site storage for the browser's own persistent session (bookmarks/history themselves live in Anchoran's own data store and are cleared separately from the Browser's own UI). */
ipcMain.handle("anchoran:clear-browser-data", async () => {
  try {
    await session.fromPartition("persist:anchoran-browser").clearStorageData();
    await session.fromPartition("persist:anchoran-browser").clearCache();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

/**
 * Real filesystem access for the Files app, Notes, and every app that
 * saves what it creates (Paint, Screenshot, Voice Recorder, …).
 * Anchoran's Files app now browses the user's actual Windows folders
 * directly — this is the one narrow, purpose-built IPC surface the
 * sandboxed renderer goes through to do that; it never gets direct
 * Node `fs` access itself (contextIsolation + sandbox stay on). Every
 * operation here is exactly what a normal file manager already does
 * with the user's own files — nothing elevated, nothing bypassing an
 * OS permission the signed-in user doesn't already have.
 */
const TEXT_FILE_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".csv", ".log", ".js", ".ts", ".tsx", ".jsx", ".css", ".html", ".xml",
  ".yml", ".yaml", ".ini", ".cfg", ".conf", ".bat", ".ps1", ".sh", ".py", ".java", ".c", ".cpp",
  ".h", ".cs", ".sql", ".env", "",
]);

function isLikelyTextFile(filePath: string): boolean {
  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

ipcMain.handle("anchoran:fs-special-folders", () => ({
  home: app.getPath("home"),
  desktop: app.getPath("desktop"),
  documents: app.getPath("documents"),
  downloads: app.getPath("downloads"),
  pictures: app.getPath("pictures"),
  music: app.getPath("music"),
  videos: app.getPath("videos"),
}));

async function listDrivesRaw(): Promise<string[]> {
  if (process.platform !== "win32") return ["/"];
  const { stdout } = await new Promise<{ stdout: string }>((resolve) => {
    execFile("wmic", ["logicaldisk", "get", "name"], (_err, out) => resolve({ stdout: out ?? "" }));
  });
  const drives = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[A-Za-z]:$/.test(l))
    .map((l) => `${l}\\`);
  return drives.length > 0 ? drives : ["C:\\"];
}

ipcMain.handle("anchoran:fs-list-drives", () => listDrivesRaw());

// Polls for a drive letter appearing or disappearing — a USB stick or
// a mapped network drive — and tells the renderer so it can surface a
// clear, real "USB drive connected" notification instead of the
// change only becoming visible the next time someone happens to
// reopen Files. C: is never reported since it's always present.
let knownDrives: Set<string> | null = null;
function startDriveWatcher() {
  setInterval(async () => {
    const current = new Set(await listDrivesRaw());
    if (knownDrives === null) {
      knownDrives = current;
      return;
    }
    for (const drive of current) {
      if (!knownDrives.has(drive) && drive.toUpperCase() !== "C:\\") {
        mainWindow?.webContents.send("anchoran:drive-connected", drive);
      }
    }
    for (const drive of knownDrives) {
      if (!current.has(drive) && drive.toUpperCase() !== "C:\\") {
        mainWindow?.webContents.send("anchoran:drive-disconnected", drive);
      }
    }
    knownDrives = current;
  }, 4000);
}

interface FsEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
  createdAt: number;
}

ipcMain.handle("anchoran:fs-list-dir", (_event, dirPath: string) => {
  try {
    const names = fs.readdirSync(dirPath);
    const entries: FsEntry[] = [];
    for (const name of names) {
      const full = path.join(dirPath, name);
      try {
        const stat = fs.statSync(full);
        entries.push({
          name,
          path: full,
          isDirectory: stat.isDirectory(),
          size: stat.size,
          modifiedAt: stat.mtimeMs,
          createdAt: stat.birthtimeMs,
        });
      } catch {
        // Unreadable entry (permissions, broken link, …) — skip rather than fail the whole listing.
      }
    }
    return { entries };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("anchoran:fs-read-text-file", (_event, filePath: string) => {
  try {
    return { content: fs.readFileSync(filePath, "utf-8") };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
};

ipcMain.handle("anchoran:fs-read-image-file", (_event, filePath: string) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = IMAGE_MIME_BY_EXT[ext];
    if (!mime) return { error: "Not a recognized image type." };
    const buffer = fs.readFileSync(filePath);
    return { dataUrl: `data:${mime};base64,${buffer.toString("base64")}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("anchoran:fs-is-text-file", (_event, filePath: string) => isLikelyTextFile(filePath));

/** Generic raw-bytes reader for Quick Look's archive inspector (peeking inside a .zip without extracting it). */
ipcMain.handle("anchoran:fs-read-binary", (_event, filePath: string) => {
  try {
    return { base64: fs.readFileSync(filePath).toString("base64") };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("anchoran:fs-write-text-file", (_event, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("anchoran:fs-create-folder", (_event, parentPath: string, name: string) => {
  try {
    const target = path.join(parentPath, name);
    fs.mkdirSync(target, { recursive: false });
    return { path: target };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("anchoran:fs-create-file", (_event, parentPath: string, name: string, content: string = "") => {
  try {
    const target = path.join(parentPath, name);
    fs.writeFileSync(target, content, "utf-8");
    return { path: target };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

/** For apps that generate binary content (Paint's PNG, a voice memo's webm, …) as a data URL — decodes and writes real bytes, not the literal "data:...;base64,..." text. */
ipcMain.handle("anchoran:fs-write-data-url", (_event, parentPath: string, name: string, dataUrl: string) => {
  try {
    const base64 = dataUrl.split(",")[1] ?? "";
    const target = path.join(parentPath, name);
    fs.writeFileSync(target, Buffer.from(base64, "base64"));
    return { path: target };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("anchoran:fs-rename", (_event, oldPath: string, newName: string) => {
  try {
    const target = path.join(path.dirname(oldPath), newName);
    fs.renameSync(oldPath, target);
    return { path: target };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

/** Sends to the real Windows Recycle Bin — recoverable there, same as deleting in Explorer. Never a permanent unlink. Kept for anywhere still using it; Files itself now uses Anchoran's own trash below instead. */
ipcMain.handle("anchoran:fs-delete", async (_event, paths: string[]) => {
  const errors: string[] = [];
  for (const p of paths) {
    try {
      await shell.trashItem(p);
    } catch (err) {
      errors.push(`${path.basename(p)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return errors.length > 0 ? { success: false, error: errors.join("; ") } : { success: true };
});

/**
 * Anchoran's own trash — separate from the real Windows Recycle Bin,
 * so a deleted item can be browsed and restored entirely from inside
 * Files, without switching to Windows Explorer's own bin. Trades away
 * showing up in Windows' Recycle Bin (a real, deliberate difference —
 * see CHANGELOG.md) for a trash Anchoran fully owns and controls.
 */
const trashDir = path.join(dataRoot, "trash");
fs.mkdirSync(trashDir, { recursive: true });
interface TrashItem {
  id: string;
  originalPath: string;
  name: string;
  isDirectory: boolean;
  deletedAt: number;
}
const trashStore = new Store<{ items: TrashItem[] }>({ name: "trash-index", cwd: dataRoot, defaults: { items: [] } });

function moveWithFallback(src: string, dest: string) {
  try {
    fs.renameSync(src, dest);
  } catch {
    fs.cpSync(src, dest, { recursive: true });
    fs.rmSync(src, { recursive: true, force: true });
  }
}

ipcMain.handle("anchoran:trash-move", (_event, paths: string[]) => {
  const errors: string[] = [];
  const movedIds: string[] = [];
  const items = trashStore.get("items");
  for (const p of paths) {
    try {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const stat = fs.statSync(p);
      moveWithFallback(p, path.join(trashDir, id));
      items.push({ id, originalPath: p, name: path.basename(p), isDirectory: stat.isDirectory(), deletedAt: Date.now() });
      movedIds.push(id);
    } catch (err) {
      errors.push(`${path.basename(p)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  trashStore.set("items", items);
  return errors.length > 0 ? { success: false, error: errors.join("; "), ids: movedIds } : { success: true, ids: movedIds };
});

ipcMain.handle("anchoran:trash-list", () => trashStore.get("items"));

ipcMain.handle("anchoran:trash-restore", (_event, id: string) => {
  const items = trashStore.get("items");
  const item = items.find((i) => i.id === id);
  if (!item) return { success: false, error: "Not found in trash." };
  try {
    let destination = item.originalPath;
    if (fs.existsSync(destination)) {
      const ext = path.extname(destination);
      const base = ext ? destination.slice(0, -ext.length) : destination;
      destination = `${base} (restored)${ext}`;
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    moveWithFallback(path.join(trashDir, item.id), destination);
    trashStore.set("items", items.filter((i) => i.id !== id));
    return { success: true, restoredTo: destination };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("anchoran:trash-delete-permanently", (_event, id: string) => {
  const items = trashStore.get("items");
  const item = items.find((i) => i.id === id);
  if (!item) return { success: false, error: "Not found in trash." };
  try {
    fs.rmSync(path.join(trashDir, item.id), { recursive: true, force: true });
    trashStore.set("items", items.filter((i) => i.id !== id));
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("anchoran:trash-empty", () => {
  try {
    fs.rmSync(trashDir, { recursive: true, force: true });
    fs.mkdirSync(trashDir, { recursive: true });
    trashStore.set("items", []);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

function copyRecursive(src: string, destDir: string) {
  const dest = path.join(destDir, path.basename(src));
  fs.cpSync(src, dest, { recursive: true });
}

ipcMain.handle("anchoran:fs-copy", (_event, sourcePaths: string[], destDir: string) => {
  try {
    for (const src of sourcePaths) copyRecursive(src, destDir);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("anchoran:fs-move", (_event, sourcePaths: string[], destDir: string) => {
  try {
    for (const src of sourcePaths) {
      const dest = path.join(destDir, path.basename(src));
      try {
        fs.renameSync(src, dest);
      } catch {
        // Cross-drive moves can't be a simple rename — fall back to copy + remove original.
        fs.cpSync(src, dest, { recursive: true });
        fs.rmSync(src, { recursive: true, force: true });
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("anchoran:fs-open-path", async (_event, filePath: string) => {
  const err = await shell.openPath(filePath);
  return { success: !err, error: err || undefined };
});

/**
 * The real Windows "How do you want to open this file?" picker —
 * `rundll32 shell32.dll,OpenAs_RunDLL` is the standard, long-documented
 * way any desktop app invokes it; there's no other public API for it.
 */
/**
 * The real Windows "How do you want to open this file?" picker.
 * OpenWith.exe (System32, shipped since Windows Vista) is the modern,
 * direct executable behind Explorer's own "Open with" — simpler and
 * more reliable than the older rundll32 shell32.dll,OpenAs_RunDLL
 * trick this used to call, which a real user reported doing nothing.
 * Returns success/failure instead of firing-and-forgetting, so the UI
 * can actually surface an error instead of silently doing nothing a
 * second time if this fails too.
 */
ipcMain.handle("anchoran:fs-open-with", (_event, filePath: string) => {
  if (process.platform !== "win32") return { success: false, error: "Only supported on Windows." };
  const systemRoot = process.env.SystemRoot || "C:\\Windows";
  const openWithExe = path.join(systemRoot, "System32", "OpenWith.exe");
  return new Promise((resolve) => {
    execFile(openWithExe, [filePath], (err) => {
      if (err) {
        logToDisk("fs-open-with", `OpenWith.exe failed for ${filePath}: ${err.message}`);
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

ipcMain.on("anchoran:fs-show-in-explorer", (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

/**
 * `<webview>` guest pages (Chat, and formerly Browser) don't get a
 * native right-click menu for free the way a normal browser tab does
 * — Electron only gives you the raw `context-menu` event with details
 * about what was clicked (an image, a link, editable text, a
 * selection…), and building the actual menu is on the app. This is
 * that: the renderer forwards the event here (Menu is a main-process-
 * only module), and the resulting menu acts directly on the guest
 * page's own WebContents — copy/cut/paste, copy the real image or
 * link, standard browser-context-menu behavior.
 */
ipcMain.on(
  "anchoran:webview-context-menu",
  (
    _event,
    webContentsId: number,
    x: number,
    y: number,
    params: { isEditable: boolean; selectionText: string; linkURL: string; srcURL: string; hasImageContents: boolean }
  ) => {
    const guest = webContents.fromId(webContentsId);
    if (!guest) return;
    const items: Electron.MenuItemConstructorOptions[] = [];

    if (params.hasImageContents) {
      items.push({ label: "Copy Image", click: () => guest.copyImageAt(x, y) });
      if (params.srcURL) {
        items.push({ label: "Copy Image Address", click: () => clipboard.writeText(params.srcURL) });
        items.push({
          label: "Set as Wallpaper",
          click: async () => {
            try {
              const res = await fetch(params.srcURL);
              const contentType = res.headers.get("content-type") ?? "image/png";
              if (!res.ok || !contentType.startsWith("image/")) return;
              const buffer = Buffer.from(await res.arrayBuffer());
              const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
              mainWindow?.webContents.send("anchoran:set-image-as-wallpaper", dataUrl);
            } catch {
              // Silently ignored — the renderer has no error surface for this menu action.
            }
          },
        });
        items.push({
          label: "Save Image As…",
          click: async () => {
            try {
              const res = await fetch(params.srcURL);
              const contentType = res.headers.get("content-type") ?? "image/png";
              if (!res.ok || !contentType.startsWith("image/")) return;
              const buffer = Buffer.from(await res.arrayBuffer());
              const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
              const name = params.srcURL.split("/").pop()?.split("?")[0] || "image.png";
              mainWindow?.webContents.send("anchoran:save-image-from-browser", { dataUrl, name });
            } catch {
              // Silently ignored — the renderer has no error surface for this menu action.
            }
          },
        });
      }
    }
    if (params.linkURL) {
      items.push({ label: "Copy Link Address", click: () => clipboard.writeText(params.linkURL) });
    }
    if (params.isEditable) {
      items.push(
        { label: "Cut", click: () => guest.cut() },
        { label: "Copy", click: () => guest.copy(), enabled: !!params.selectionText },
        { label: "Paste", click: () => guest.paste() }
      );
    } else if (params.selectionText) {
      items.push({ label: "Copy", click: () => guest.copy() });
    }
    if (items.length > 0) items.push({ type: "separator" });
    items.push(
      { label: "Select All", click: () => guest.selectAll() },
      { label: "Reload", click: () => guest.reload() }
    );

    Menu.buildFromTemplate(items).popup();
  }
);

/**
 * Recycle Bin: rather than reimplementing Windows' own undocumented
 * $Recycle.Bin storage format, this opens the real, actual Recycle
 * Bin — the same window Explorer itself shows — via its shell
 * namespace path. Anchoran already deletes into this exact place (see
 * fs-delete's shell.trashItem above), so this is just giving it a
 * front door instead of requiring a trip out to Explorer to see it.
 */
ipcMain.on("anchoran:open-recycle-bin", () => {
  if (process.platform === "win32") execFile("explorer.exe", ["shell:RecycleBinFolder"]);
});

/** Storage Usage's quick cleanup: empties the real Recycle Bin via PowerShell's own cmdlet for it. */
ipcMain.handle("anchoran:empty-recycle-bin", () => {
  if (process.platform !== "win32") return { success: false, error: "Only supported on Windows." };
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-Command", "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"],
      (err) => {
        if (err) resolve({ success: false, error: err.message });
        else resolve({ success: true });
      }
    );
  });
});

/** Storage Usage's quick cleanup: clears Anchoran's own disposable cache folder (generated PDFs, etc. — see save-and-open-file above) and reports bytes freed. */
ipcMain.handle("anchoran:clear-cache", () => {
  try {
    let freed = 0;
    for (const name of fs.readdirSync(cacheDir)) {
      const full = path.join(cacheDir, name);
      try {
        freed += fs.statSync(full).size;
        fs.rmSync(full, { recursive: true, force: true });
      } catch {
        // Skip anything that can't be removed rather than failing the whole cleanup.
      }
    }
    return { success: true, freedBytes: freed };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

/**
 * On-Screen Keyboard and Narrator: Windows already ships fully-working,
 * properly localized, deeply OS-integrated versions of both — building
 * a custom replacement would be a large undertaking for a strictly
 * worse result. These just launch the real ones.
 */
ipcMain.on("anchoran:open-osk", () => {
  if (process.platform === "win32") execFile("osk.exe");
});
ipcMain.on("anchoran:open-narrator", () => {
  if (process.platform === "win32") execFile("narrator.exe");
});

/**
 * Startup Apps: reads/manages the real per-user Windows "Run" startup
 * entries (HKCU\...\Run) — the same list Windows' own Task Manager
 * "Startup apps" tab shows. Reading and removing a value here needs no
 * elevation and touches nothing Windows considers critical/recovery —
 * it's exactly the same action a user could take themselves in Task
 * Manager.
 */
const STARTUP_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";

/** Pulls the actual executable path out of a Run-key command string (which may be quoted and/or have arguments after it) so its existence can be checked for real. */
function extractExePath(command: string): string | null {
  const quoted = command.match(/^\s*"([^"]+)"/);
  if (quoted) return quoted[1];
  const bare = command.match(/^\s*(\S+\.exe)/i);
  return bare ? bare[1] : null;
}

ipcMain.handle("anchoran:list-startup-items", async () => {
  if (process.platform !== "win32") return [];
  const { success, output } = await runReg(["query", STARTUP_KEY]);
  if (!success) return [];
  const items: { name: string; command: string; exists: boolean }[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s{4}(\S.*?)\s{4}REG_\S+\s{4}(.*)$/);
    if (!match) continue;
    const command = match[2].trim();
    const exePath = extractExePath(command);
    // No resolvable path (e.g. a bare rundll32 call with no exe token)
    // is treated as "exists" — there's nothing concrete to flag as
    // missing, so it shouldn't be marked broken just because parsing
    // couldn't pin down a file.
    const exists = exePath ? fs.existsSync(exePath) : true;
    items.push({ name: match[1], command, exists });
  }
  return items;
});

ipcMain.handle("anchoran:remove-startup-item", async (_event, name: string) => {
  const { success, output } = await runReg(["delete", STARTUP_KEY, "/v", name, "/f"]);
  return success ? { success: true } : { success: false, error: output };
});

/**
 * Real Windows process list, as a tree by parent process id — the
 * same information Task Manager's own process view is built from.
 * "End task" runs the same `taskkill` a user could run themselves; a
 * confirmation in the UI is required before calling it, since unlike
 * closing an Anchoran window, this can affect any real process on the
 * system.
 */
ipcMain.handle("anchoran:list-processes", async () => {
  if (process.platform !== "win32") return [];
  const { stdout } = await new Promise<{ stdout: string }>((resolve) => {
    execFile(
      "wmic",
      ["process", "get", "Name,ProcessId,ParentProcessId", "/format:csv"],
      (_err, out) => resolve({ stdout: out ?? "" })
    );
  });
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const processes: { pid: number; parentPid: number; name: string }[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    if (cols.length < 4) continue;
    const [, name, parentPid, pid] = cols;
    if (!name || Number.isNaN(Number(pid))) continue;
    processes.push({ pid: Number(pid), parentPid: Number(parentPid), name });
  }
  return processes;
});

ipcMain.handle("anchoran:kill-process", async (_event, pid: number) => {
  return new Promise((resolve) => {
    execFile("taskkill", ["/PID", String(pid), "/F"], (err, _out, stderr) => {
      resolve(err ? { success: false, error: stderr || err.message } : { success: true });
    });
  });
});

/** Storage usage: real per-drive free/total space, plus a size breakdown of the well-known folders. */
ipcMain.handle("anchoran:get-disk-usage", async () => {
  if (process.platform !== "win32") return { drives: [] };
  const { stdout } = await new Promise<{ stdout: string }>((resolve) => {
    execFile("wmic", ["logicaldisk", "get", "Caption,FreeSpace,Size", "/format:csv"], (_err, out) => resolve({ stdout: out ?? "" }));
  });
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const drives: { caption: string; free: number; total: number }[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    if (cols.length < 4) continue;
    const [, caption, free, total] = cols;
    if (!caption || !total) continue;
    drives.push({ caption, free: Number(free) || 0, total: Number(total) || 0 });
  }
  return { drives };
});

function dirSize(dirPath: string, depth = 0): number {
  if (depth > 6) return 0;
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    try {
      if (entry.isDirectory()) total += dirSize(full, depth + 1);
      else total += fs.statSync(full).size;
    } catch {
      // Unreadable entry — skip.
    }
  }
  return total;
}

ipcMain.handle("anchoran:get-folder-sizes", (_event, paths: { label: string; path: string }[]) => {
  return paths.map(({ label, path: p }) => ({ label, path: p, size: dirSize(p) }));
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

/** Administrator Terminal's "regquery" — read-only registry lookups (deliberately never "add"/"delete"; those already exist as their own narrow, purpose-built handlers elsewhere in this file). */
ipcMain.handle("anchoran:reg-query", async (_event, key: string) => {
  if (process.platform !== "win32") return { success: false, error: "Only supported on Windows." };
  const { success, output } = await runReg(["query", key]);
  return success ? { success: true, output } : { success: false, error: output };
});

/** Administrator Terminal's "ping" — shells out to Windows' own ping.exe rather than reimplementing ICMP. */
ipcMain.handle("anchoran:ping-host", (_event, host: string) => {
  return new Promise((resolve) => {
    execFile("ping.exe", ["-n", "4", host], { timeout: 12000 }, (err, stdout, stderr) => {
      resolve({ success: !err, output: err ? stderr || stdout || String(err) : stdout });
    });
  });
});

/**
 * Administrator Terminal's "restartexplorer" — the exact same real,
 * recoverable operation Task Manager's own "Restart" on explorer.exe
 * performs: end the real Windows shell process and relaunch it. Only
 * meaningful outside System Mode (Anchoran itself is the shell then,
 * so there's no explorer.exe running to restart in the first place).
 */
ipcMain.handle("anchoran:restart-explorer", () => {
  if (process.platform !== "win32") return { success: false, error: "Only supported on Windows." };
  return new Promise((resolve) => {
    execFile("taskkill", ["/IM", "explorer.exe", "/F"], () => {
      spawn("explorer.exe", [], { detached: true }).unref();
      resolve({ success: true });
    });
  });
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

// electron-updater defaults this to true: once an update has
// downloaded, quitting the app *at all* (closing it normally, Alt+F4,
// task manager, anything) silently runs the installer as part of that
// quit — completely outside Anchoran's own UI, with no fullscreen
// cinematic, no matter how the quit happened. The only install path
// Anchoran wants is the explicit one below (anchoran:quit-and-install-
// update), which always goes through UpdateTheater first.
autoUpdater.autoInstallOnAppQuit = false;

// Optional beta channel: when enabled, electron-updater also
// considers GitHub releases marked "pre-release" as valid updates,
// not only full releases. Honest scope note: this makes the switch
// itself real and working, but Anchoran's own release workflow
// doesn't currently publish any pre-release builds — so until it
// does, turning this on has nothing beta to actually find yet.
// The persisted value is applied once configStore is the real,
// possibly-encrypted store (see app.whenReady() below) rather than
// read here, before that swap has happened.

ipcMain.handle("anchoran:set-beta-channel", (_event, enabled: boolean) => {
  configStore.set("betaChannel", enabled);
  autoUpdater.allowPrerelease = enabled;
  return { success: true };
});

ipcMain.handle("anchoran:get-beta-channel", () => configStore.get("betaChannel", false) as boolean);

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
 * "changeto" (the Administrator Terminal's `anchoran changeto vX.Y.Z`
 * command): switches straight to any specific installable release —
 * forward OR backward — rather than only the newest one electron-
 * updater's own feed knows about. Since that's outside what
 * electron-updater is designed for, this bypasses it entirely and
 * drives the same NSIS installer by hand: download that exact
 * release's update package from its GitHub Release, then run it
 * silently (/S) and quit, the same way quitAndInstall above does.
 */
type ChangeToStatus =
  | { state: "downloading"; percent: number }
  | { state: "downloaded" }
  | { state: "installing" }
  | { state: "error"; message: string };

// Set once changeto-download finishes, consumed by changeto-install — this
// is what lets the renderer show the same UpdateTheater cinematic in
// between "downloaded" and "actually install and quit", instead of those
// two happening back-to-back with no visible transition.
let pendingChangeToPath: string | null = null;
let pendingChangeToVersion: string | null = null;

function sendChangeToStatus(status: ChangeToStatus) {
  mainWindow?.webContents.send("anchoran:changeto-status", status);
}

function downloadToFile(url: string, destPath: string, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    function request(currentUrl: string, redirectsLeft: number) {
      https
        .get(currentUrl, { headers: { "User-Agent": "AnchoranOS" } }, (res) => {
          const status = res.statusCode ?? 0;
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            if (redirectsLeft <= 0) {
              reject(new Error("Too many redirects."));
              return;
            }
            request(res.headers.location, redirectsLeft - 1);
            return;
          }
          if (status !== 200) {
            res.resume();
            reject(new Error(`Download failed (HTTP ${status}). That version may not have a Windows installer attached.`));
            return;
          }
          const total = Number(res.headers["content-length"] ?? 0);
          let downloaded = 0;
          const fileStream = fs.createWriteStream(destPath);
          res.on("data", (chunk: Buffer) => {
            downloaded += chunk.length;
            if (total > 0) onProgress(Math.round((downloaded / total) * 100));
          });
          res.pipe(fileStream);
          fileStream.on("finish", () => fileStream.close(() => resolve()));
          fileStream.on("error", reject);
          res.on("error", reject);
        })
        .on("error", reject);
    }
    request(url, 5);
  });
}

// Phase 1: download only. The renderer shows the real UpdateTheater
// cinematic (the same one every other update path uses) after this
// resolves, and only calls changeto-install once that cinematic
// finishes — so "changeto" now looks and behaves exactly like a normal
// update, instead of just vanishing with no visible transition.
ipcMain.handle("anchoran:changeto-download", async (_event, rawVersion: string) => {
  if (isDev) return { success: false, error: "Not available in development mode." };
  const version = String(rawVersion).replace(/^v/i, "");
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    return { success: false, error: "Invalid version." };
  }

  const assetUrl = `https://github.com/fachu2012/Anchoran-OS/releases/download/v${version}/AnchoranOS-UpdatePackage-${version}.exe`;
  const destPath = path.join(app.getPath("temp"), `AnchoranOS-UpdatePackage-${version}.exe`);

  try {
    sendChangeToStatus({ state: "downloading", percent: 0 });
    await downloadToFile(assetUrl, destPath, (percent) => sendChangeToStatus({ state: "downloading", percent }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendChangeToStatus({ state: "error", message });
    return { success: false, error: message };
  }

  pendingChangeToPath = destPath;
  pendingChangeToVersion = version;
  sendChangeToStatus({ state: "downloaded" });
  return { success: true };
});

// Phase 2: actually run the already-downloaded installer and quit —
// only ever called from UpdateTheater's onComplete, after its cinematic
// has played. `--updated --force-run` (the exact args electron-updater
// itself passes for a silent, auto-relaunching NSIS install — see
// node_modules/electron-updater/out/NsisUpdater.js) is what makes
// Anchoran actually reopen on its own afterward, instead of leaving the
// user to launch it back up manually.
ipcMain.handle("anchoran:changeto-install", () => {
  if (!pendingChangeToPath || !pendingChangeToVersion) {
    return { success: false, error: "No downloaded version pending — run changeto again." };
  }
  isQuittingConfirmed = true;
  configStore.set("pendingUpdateVersion", pendingChangeToVersion);
  sendChangeToStatus({ state: "installing" });
  try {
    spawn(pendingChangeToPath, ["--updated", "/S", "--force-run"], { detached: true, stdio: "ignore" }).unref();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendChangeToStatus({ state: "error", message });
    return { success: false, error: message };
  }
  // A short delay so the installer has actually launched before this
  // process (and the files it might be holding open) goes away.
  setTimeout(() => app.quit(), 500);
  return { success: true };
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

/**
 * Real external Windows app embedding: launches a real .exe and
 * reparents its window into Anchoran's own window via
 * native/windowembed's helper (SetParent + strips its title bar) — see
 * that helper's Program.cs for the full protocol and its stated
 * "airspace" limitation: the embedded window always renders above
 * every other Anchoran UI element in the screen region it occupies.
 * That's an inherent limit of mixing a real Win32 child window with a
 * GPU-composited Chromium surface, not something fixable here without
 * a full compositor (DirectComposition) — stated once, honestly,
 * rather than pretended away. One helper process per embedded window,
 * keyed by the Anchoran windowId that owns it.
 */
const embedProcesses = new Map<string, ReturnType<typeof spawn>>();

function windowEmbedExePath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "AnchoranWindowEmbed.exe")
    : path.join(__dirname, "..", "native", "windowembed", "bin", "Release", "net8.0", "win-x64", "publish", "AnchoranWindowEmbed.exe");
}

/** Anchoran's own top-level HWND, as a decimal string the .NET helper's SetParent can consume. */
function nativeWindowHandleDecimal(): string | null {
  if (!mainWindow) return null;
  const buf = mainWindow.getNativeWindowHandle();
  if (buf.length >= 8) return buf.readBigUInt64LE(0).toString();
  if (buf.length >= 4) return buf.readUInt32LE(0).toString();
  return null;
}

function stopEmbed(windowId: string) {
  const proc = embedProcesses.get(windowId);
  if (!proc) return;
  try {
    proc.stdin?.write("EXIT\n");
  } catch {
    // Falls through to a hard kill below regardless.
  }
  embedProcesses.delete(windowId);
  setTimeout(() => {
    if (!proc.killed) proc.kill();
  }, 1500);
}

ipcMain.handle("anchoran:embed-start", (_event, windowId: string, exePath: string) => {
  if (process.platform !== "win32") return { success: false, error: "Only supported on Windows." };
  if (embedProcesses.has(windowId)) return { success: true };

  const helperPath = windowEmbedExePath();
  if (!fs.existsSync(helperPath)) {
    return {
      success: false,
      error: isDev
        ? "Run `npm run build:windowembed` first — it isn't built automatically in dev mode."
        : "The window-embedding helper is missing from this build.",
    };
  }
  if (!fs.existsSync(exePath)) {
    return { success: false, error: `${exePath} doesn't exist.` };
  }
  const parentHandle = nativeWindowHandleDecimal();
  if (!parentHandle) return { success: false, error: "Couldn't read Anchoran's own window handle." };

  try {
    const child = spawn(helperPath, [exePath, parentHandle]);
    embedProcesses.set(windowId, child);

    child.stdout.setEncoding("utf-8");
    let buffer = "";
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("EMBEDDED")) {
          mainWindow?.webContents.send("anchoran:embed-status", { windowId, state: "embedded" });
        } else if (line === "CLOSED") {
          embedProcesses.delete(windowId);
          mainWindow?.webContents.send("anchoran:embed-status", { windowId, state: "closed" });
        } else if (line.startsWith("ERROR")) {
          embedProcesses.delete(windowId);
          mainWindow?.webContents.send("anchoran:embed-status", { windowId, state: "error", message: line.slice(6).trim() });
        }
      }
    });

    child.on("exit", (code, signal) => {
      // The helper reports every expected outcome (embedded/closed/
      // error) as its own stdout line before exiting, so this only
      // fires unexpectedly — the helper crashed, was killed (some
      // games' anti-cheat kills processes that touch their window via
      // SetParent/SetWindowLong), or exited without a final flushed
      // line. Left unhandled, the renderer would just sit on
      // "Starting…" forever with no way to know anything went wrong.
      if (embedProcesses.get(windowId) === child) {
        embedProcesses.delete(windowId);
        mainWindow?.webContents.send("anchoran:embed-status", {
          windowId,
          state: "error",
          message:
            signal
              ? `The embedding helper was terminated (${signal}) — some games' anti-cheat blocks this.`
              : `The embedding helper exited unexpectedly (code ${code}).`,
        });
      }
    });
    child.on("error", (err) => {
      logToDisk("windowembed", `Helper process error: ${err.message}`);
      if (embedProcesses.get(windowId) === child) embedProcesses.delete(windowId);
      mainWindow?.webContents.send("anchoran:embed-status", { windowId, state: "error", message: err.message });
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.on("anchoran:embed-bounds", (_event, windowId: string, x: number, y: number, width: number, height: number) => {
  embedProcesses.get(windowId)?.stdin?.write(`BOUNDS ${Math.round(x)} ${Math.round(y)} ${Math.round(width)} ${Math.round(height)}\n`);
});

ipcMain.on("anchoran:embed-visibility", (_event, windowId: string, visible: boolean) => {
  embedProcesses.get(windowId)?.stdin?.write(`${visible ? "SHOW" : "HIDE"}\n`);
});

ipcMain.on("anchoran:embed-focus", (_event, windowId: string) => {
  embedProcesses.get(windowId)?.stdin?.write("FOCUS\n");
});

ipcMain.handle("anchoran:embed-stop", (_event, windowId: string) => {
  stopEmbed(windowId);
  return { success: true };
});

app.whenReady().then(() => {
  // Never let anything in here — encryption setup included — stop the
  // app from actually reaching createMainWindow() below. A real
  // incident already happened once: an uncaught error at this exact
  // point, before a window ever opened, left Anchoran unable to start
  // at all. Anything that goes wrong here now logs and falls back to
  // the plain (still functional) placeholder stores instead.
  try {
    const encryptionKey = getOrCreateEncryptionKey() ?? undefined;
    configStore = openEncryptedStore("preferences", configDir, encryptionKey);
    dataStore = openEncryptedStore("filesystem", dataDir, encryptionKey);
    if (!encryptionKey) {
      logToDisk("encryption", "safeStorage unavailable — preferences/filesystem stores stay unencrypted on disk.");
    }
  } catch (err) {
    logToDisk("encryption", `Setting up encrypted storage failed unexpectedly: ${err instanceof Error ? err.stack ?? err.message : String(err)}. Continuing with the unencrypted placeholder stores so Anchoran can still start.`);
  }
  autoUpdater.allowPrerelease = configStore.get("betaChannel", false) as boolean;

  // Automatic update-failure detection: the first launch of a newly
  // updated version starts a health check that only clears once the
  // renderer actually confirms the desktop finished booting (see
  // anchoran:boot-complete below). If that confirmation is still
  // missing from the *previous* launch of this exact version — it
  // crashed or hung before ever reaching a working desktop — this
  // flags a real update failure, surfaced via anchoran:get-update-
  // failure-info so the UI can offer reinstalling the last version
  // that's known to have actually worked. True binary rollback (auto-
  // reinstalling the old build without the user's involvement) isn't
  // attempted here — Anchoran doesn't retain old installer bytes long
  // enough for that — this is the honest, one-click-away version.
  const lastKnownGoodVersion = configStore.get("lastKnownGoodVersion", null) as string | null;
  let updateFailureDetected = false;
  if (lastKnownGoodVersion && lastKnownGoodVersion !== ANCHORAN_VERSION) {
    const pending = configStore.get("pendingHealthCheck", null) as { version: string } | null;
    if (pending && pending.version === ANCHORAN_VERSION) {
      updateFailureDetected = true;
      logToDisk("updater", `v${ANCHORAN_VERSION} never confirmed a successful boot on its previous launch — flagging as a failed update.`);
    }
    configStore.set("pendingHealthCheck", { version: ANCHORAN_VERSION });
  } else {
    configStore.delete("pendingHealthCheck");
  }

  ipcMain.handle("anchoran:get-update-failure-info", () => ({
    failed: updateFailureDetected,
    lastKnownGoodVersion,
  }));

  ipcMain.handle("anchoran:boot-complete", () => {
    configStore.set("lastKnownGoodVersion", ANCHORAN_VERSION);
    configStore.delete("pendingHealthCheck");
    return { success: true };
  });

  // A real external-browser opener, restricted to https:// — used by
  // the update-failure notice's "Reinstall" link (a real GitHub
  // release download) rather than a webview navigation.
  ipcMain.handle("anchoran:open-external", (_event, url: string) => {
    if (!/^https:\/\//i.test(url)) return { success: false, error: "Only https:// URLs are allowed." };
    shell.openExternal(url);
    return { success: true };
  });

  createMainWindow();
  startDriveWatcher();
  registerGlobalShortcuts();
  interceptWebviewDownloads();
  setupTrackerBlocking();
  setupPermissionPolicy();
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
  for (const windowId of embedProcesses.keys()) stopEmbed(windowId);
});

app.on("window-all-closed", () => {
  app.quit();
});
