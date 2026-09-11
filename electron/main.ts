import { app, BrowserWindow, globalShortcut, ipcMain, screen } from "electron";
import path from "node:path";
import fs from "node:fs";

const isDev = process.env.ANCHORAN_DEV === "1";

// version.json is the single source of truth for Anchoran's version.
// It is read once at startup and exposed to the renderer over IPC.
const versionFile = path.join(__dirname, "..", "version.json");
const ANCHORAN_VERSION: string = JSON.parse(fs.readFileSync(versionFile, "utf-8")).version;

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
    backgroundColor: "#0B0E14",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
 * Anchoran intercepts the Windows key as a *global shortcut* to open its
 * own Launcher, which Windows permits ordinary apps to do. This is a
 * best-effort UX affordance, not a lock: Windows itself, or the user,
 * can always regain control (Ctrl+Alt+Del, Task Manager, sign-out, etc.
 * are never disabled or intercepted by Anchoran). Anchoran never
 * modifies system security policy and never disables OS-level recovery
 * or emergency mechanisms.
 */
function registerGlobalShortcuts() {
  // "Super" is Electron's accelerator name for the Windows key.
  const registered = globalShortcut.register("Super", () => {
    mainWindow?.webContents.send("anchoran:toggle-launcher");
  });

  if (!registered) {
    console.warn(
      "[Anchoran] Could not register the Windows key as a global shortcut. " +
        "Another application may already be using it. The Launcher remains " +
        "available from the system bar."
    );
  }
}

ipcMain.handle("anchoran:get-version", () => ANCHORAN_VERSION);

ipcMain.on("anchoran:confirm-exit", () => {
  isQuittingConfirmed = true;
  app.quit();
});

ipcMain.on("anchoran:restart", () => {
  isQuittingConfirmed = true;
  app.relaunch();
  app.quit();
});

app.whenReady().then(() => {
  createMainWindow();
  registerGlobalShortcuts();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  app.quit();
});
