import { contextBridge, ipcRenderer } from "electron";

export interface AnchoranSystemInfo {
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  cpuUsagePercent: number;
  totalMemMB: number;
  freeMemMB: number;
  systemUptimeSec: number;
}

/**
 * The only surface the renderer (React UI) is allowed to reach into
 * the host OS through. Kept intentionally small and purpose-specific:
 * version info, exit/restart flow, the Windows-key -> Launcher signal,
 * Anchoran's own on-disk config/data stores, real system info for the
 * System Monitor app, and best-effort error logging.
 */
contextBridge.exposeInMainWorld("anchoran", {
  getVersion: (): Promise<string> => ipcRenderer.invoke("anchoran:get-version"),
  confirmExit: (): void => ipcRenderer.send("anchoran:confirm-exit"),
  restart: (): void => ipcRenderer.send("anchoran:restart"),
  onRequestExitConfirmation: (callback: () => void): void => {
    ipcRenderer.on("anchoran:request-exit-confirmation", callback);
  },
  onToggleLauncher: (callback: () => void): void => {
    ipcRenderer.on("anchoran:toggle-launcher", callback);
  },
  onShortcutStatus: (callback: (status: { superRegistered: boolean; fallbackRegistered: boolean }) => void): void => {
    ipcRenderer.on("anchoran:shortcut-status", (_e, status) => callback(status));
  },

  getSystemInfo: (): Promise<AnchoranSystemInfo> => ipcRenderer.invoke("anchoran:get-system-info"),

  configGet: (key: string): Promise<unknown> => ipcRenderer.invoke("anchoran:config-get", key),
  configSet: (key: string, value: unknown): Promise<boolean> =>
    ipcRenderer.invoke("anchoran:config-set", key, value),
  dataGet: (key: string): Promise<unknown> => ipcRenderer.invoke("anchoran:data-get", key),
  dataSet: (key: string, value: unknown): Promise<boolean> =>
    ipcRenderer.invoke("anchoran:data-set", key, value),

  logError: (scope: string, message: string): void => {
    ipcRenderer.send("anchoran:log-error", scope, message);
  },

  getDisplays: (): Promise<{ id: number; label: string; isPrimary: boolean }[]> =>
    ipcRenderer.invoke("anchoran:get-displays"),
  moveToDisplay: (displayId: number): void => {
    ipcRenderer.send("anchoran:move-to-display", displayId);
  },

  importImage: (): Promise<{ dataUrl: string; fileName: string } | { error: string } | null> =>
    ipcRenderer.invoke("anchoran:import-image"),
  importMedia: (): Promise<{ dataUrl: string; fileName: string } | { error: string } | null> =>
    ipcRenderer.invoke("anchoran:import-media"),

  exportData: (): Promise<{ success: boolean; path?: string }> => ipcRenderer.invoke("anchoran:export-data"),
  importData: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke("anchoran:import-data"),
  resetData: (): Promise<boolean> => ipcRenderer.invoke("anchoran:reset-data"),

  saveAndOpenFile: (fileName: string, base64: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:save-and-open-file", fileName, base64),

  getCaptureSources: (): Promise<{ id: string; name: string; thumbnailDataUrl: string }[]> =>
    ipcRenderer.invoke("anchoran:get-capture-sources"),

  openChrome: (): Promise<{ success: boolean; usedFallback: boolean }> => ipcRenderer.invoke("anchoran:open-chrome"),

  pickZipFile: (): Promise<{ base64: string; fileName: string } | { error: string } | null> =>
    ipcRenderer.invoke("anchoran:pick-zip-file"),
  pickFolder: (title: string): Promise<string | null> => ipcRenderer.invoke("anchoran:pick-folder", title),

  showWebviewContextMenu: (
    webContentsId: number,
    x: number,
    y: number,
    params: { isEditable: boolean; selectionText: string; linkURL: string; srcURL: string; hasImageContents: boolean }
  ): void => {
    ipcRenderer.send("anchoran:webview-context-menu", webContentsId, x, y, params);
  },

  readLog: (): Promise<string[]> => ipcRenderer.invoke("anchoran:read-log"),

  checkForUpdates: (): void => {
    ipcRenderer.invoke("anchoran:check-for-updates");
  },
  onUpdateStatus: (callback: (status: unknown) => void): void => {
    ipcRenderer.on("anchoran:update-status", (_e, status) => callback(status));
  },
  quitAndInstallUpdate: (): void => {
    ipcRenderer.send("anchoran:quit-and-install-update");
  },
  consumePendingUpdate: (): Promise<string | null> => ipcRenderer.invoke("anchoran:consume-pending-update"),

  systemModeStart: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:system-mode-start"),
  systemModeStop: (): Promise<{ success: boolean }> => ipcRenderer.invoke("anchoran:system-mode-stop"),
  systemModeStatus: (): Promise<{ running: boolean; supported: boolean }> =>
    ipcRenderer.invoke("anchoran:system-mode-status"),
  onSystemModeKey: (callback: (key: "WIN" | "ALTTAB") => void): void => {
    ipcRenderer.on("anchoran:system-mode-key", (_e, key) => callback(key));
  },
  onSystemModeStatusChange: (callback: (running: boolean) => void): void => {
    ipcRenderer.on("anchoran:system-mode-status", (_e, running) => callback(running));
  },

  // Real Windows filesystem access for Files, Notes, and every app
  // that saves what it creates — see electron/main.ts's "Real
  // filesystem" section for the full rationale.
  fsSpecialFolders: (): Promise<Record<"home" | "desktop" | "documents" | "downloads" | "pictures" | "music" | "videos", string>> =>
    ipcRenderer.invoke("anchoran:fs-special-folders"),
  fsListDrives: (): Promise<string[]> => ipcRenderer.invoke("anchoran:fs-list-drives"),
  fsListDir: (
    dirPath: string
  ): Promise<{ entries: { name: string; path: string; isDirectory: boolean; size: number; modifiedAt: number }[] } | { error: string }> =>
    ipcRenderer.invoke("anchoran:fs-list-dir", dirPath),
  fsReadTextFile: (filePath: string): Promise<{ content: string } | { error: string }> =>
    ipcRenderer.invoke("anchoran:fs-read-text-file", filePath),
  fsReadImageFile: (filePath: string): Promise<{ dataUrl: string } | { error: string }> =>
    ipcRenderer.invoke("anchoran:fs-read-image-file", filePath),
  fsIsTextFile: (filePath: string): Promise<boolean> => ipcRenderer.invoke("anchoran:fs-is-text-file", filePath),
  fsWriteTextFile: (filePath: string, content: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:fs-write-text-file", filePath, content),
  fsCreateFolder: (parentPath: string, name: string): Promise<{ path: string } | { error: string }> =>
    ipcRenderer.invoke("anchoran:fs-create-folder", parentPath, name),
  fsCreateFile: (parentPath: string, name: string, content?: string): Promise<{ path: string } | { error: string }> =>
    ipcRenderer.invoke("anchoran:fs-create-file", parentPath, name, content),
  fsWriteDataUrl: (parentPath: string, name: string, dataUrl: string): Promise<{ path: string } | { error: string }> =>
    ipcRenderer.invoke("anchoran:fs-write-data-url", parentPath, name, dataUrl),
  fsRename: (oldPath: string, newName: string): Promise<{ path: string } | { error: string }> =>
    ipcRenderer.invoke("anchoran:fs-rename", oldPath, newName),
  fsDelete: (paths: string[]): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:fs-delete", paths),
  fsCopy: (sourcePaths: string[], destDir: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:fs-copy", sourcePaths, destDir),
  fsMove: (sourcePaths: string[], destDir: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:fs-move", sourcePaths, destDir),
  fsOpenPath: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:fs-open-path", filePath),
  fsOpenWith: (filePath: string): void => {
    ipcRenderer.send("anchoran:fs-open-with", filePath);
  },
  fsShowInExplorer: (filePath: string): void => {
    ipcRenderer.send("anchoran:fs-show-in-explorer", filePath);
  },

  pickOpenTextFile: (): Promise<{ path: string; content: string } | { error: string } | null> =>
    ipcRenderer.invoke("anchoran:pick-open-text-file"),
  pickSaveTextFile: (defaultName: string, content: string): Promise<{ path: string } | { error: string } | null> =>
    ipcRenderer.invoke("anchoran:pick-save-text-file", defaultName, content),
});
