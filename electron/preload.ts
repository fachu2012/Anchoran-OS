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
  onTriggerScreenshot: (callback: () => void): void => {
    ipcRenderer.on("anchoran:trigger-screenshot", callback);
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

  exportData: (): Promise<{ success: boolean; path?: string }> => ipcRenderer.invoke("anchoran:export-data"),
  importData: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke("anchoran:import-data"),
  resetData: (): Promise<boolean> => ipcRenderer.invoke("anchoran:reset-data"),

  saveAndOpenFile: (fileName: string, base64: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:save-and-open-file", fileName, base64),

  getCaptureSources: (): Promise<{ id: string; name: string; thumbnailDataUrl: string }[]> =>
    ipcRenderer.invoke("anchoran:get-capture-sources"),
  copyImageToClipboard: (dataUrl: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:copy-image-to-clipboard", dataUrl),


  openRecycleBin: (): void => {
    ipcRenderer.send("anchoran:open-recycle-bin");
  },
  emptyRecycleBin: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:empty-recycle-bin"),
  clearCache: (): Promise<{ success: boolean; error?: string; freedBytes?: number }> =>
    ipcRenderer.invoke("anchoran:clear-cache"),
  openOsk: (): void => {
    ipcRenderer.send("anchoran:open-osk");
  },
  openNarrator: (): void => {
    ipcRenderer.send("anchoran:open-narrator");
  },
  listStartupItems: (): Promise<{ name: string; command: string; exists: boolean }[]> =>
    ipcRenderer.invoke("anchoran:list-startup-items"),
  removeStartupItem: (name: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:remove-startup-item", name),
  listProcesses: (): Promise<{ pid: number; parentPid: number; name: string }[]> =>
    ipcRenderer.invoke("anchoran:list-processes"),
  killProcess: (pid: number): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:kill-process", pid),
  getDiskUsage: (): Promise<{ drives: { caption: string; free: number; total: number }[] }> =>
    ipcRenderer.invoke("anchoran:get-disk-usage"),
  getFolderSizes: (paths: { label: string; path: string }[]): Promise<{ label: string; path: string; size: number }[]> =>
    ipcRenderer.invoke("anchoran:get-folder-sizes", paths),

  showWebviewContextMenu: (
    webContentsId: number,
    x: number,
    y: number,
    params: { isEditable: boolean; selectionText: string; linkURL: string; srcURL: string; hasImageContents: boolean }
  ): void => {
    ipcRenderer.send("anchoran:webview-context-menu", webContentsId, x, y, params);
  },
  onSetImageAsWallpaper: (callback: (dataUrl: string) => void): void => {
    ipcRenderer.on("anchoran:set-image-as-wallpaper", (_e, dataUrl) => callback(dataUrl));
  },
  onSaveImageFromBrowser: (callback: (payload: { dataUrl: string; name: string }) => void): void => {
    ipcRenderer.on("anchoran:save-image-from-browser", (_e, payload) => callback(payload));
  },

  onDownloadUpdate: (
    callback: (record: { id: string; fileName: string; path: string; receivedBytes: number; totalBytes: number; state: string }) => void
  ): void => {
    ipcRenderer.on("anchoran:download-update", (_e, record) => callback(record));
  },
  openDownload: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:open-download", filePath),
  showDownloadInExplorer: (filePath: string): void => {
    ipcRenderer.send("anchoran:show-download-in-explorer", filePath);
  },
  setTrackerBlock: (enabled: boolean): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("anchoran:set-tracker-block", enabled),
  getTrackerBlockCount: (): Promise<number> => ipcRenderer.invoke("anchoran:get-tracker-block-count"),
  setBetaChannel: (enabled: boolean): Promise<{ success: boolean }> => ipcRenderer.invoke("anchoran:set-beta-channel", enabled),
  getBetaChannel: (): Promise<boolean> => ipcRenderer.invoke("anchoran:get-beta-channel"),
  getUpdateFailureInfo: (): Promise<{ failed: boolean; lastKnownGoodVersion: string | null }> =>
    ipcRenderer.invoke("anchoran:get-update-failure-info"),
  bootComplete: (): Promise<{ success: boolean }> => ipcRenderer.invoke("anchoran:boot-complete"),
  openExternal: (url: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke("anchoran:open-external", url),
  savePageComplete: (
    webContentsId: number,
    targetDir: string,
    fileName: string
  ): Promise<{ success: boolean; error?: string; path?: string }> =>
    ipcRenderer.invoke("anchoran:save-page-complete", webContentsId, targetDir, fileName),
  fetchImageAsDataUrl: (url: string): Promise<{ dataUrl: string } | { error: string }> =>
    ipcRenderer.invoke("anchoran:fetch-image-as-data-url", url),
  clearBrowserData: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:clear-browser-data"),

  regQuery: (key: string): Promise<{ success: boolean; output?: string; error?: string }> =>
    ipcRenderer.invoke("anchoran:reg-query", key),
  pingHost: (host: string): Promise<{ success: boolean; output: string }> =>
    ipcRenderer.invoke("anchoran:ping-host", host),
  restartExplorer: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:restart-explorer"),

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

  changeToDownload: (version: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:changeto-download", version),
  changeToInstall: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:changeto-install"),
  onChangeToStatus: (callback: (status: unknown) => void): void => {
    ipcRenderer.on("anchoran:changeto-status", (_e, status) => callback(status));
  },

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

  // Real external Windows app embedding — see electron/main.ts's
  // embed-* handlers and native/windowembed/Program.cs for the full
  // protocol and its stated "airspace" limitation.
  embedStart: (windowId: string, exePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:embed-start", windowId, exePath),
  embedBounds: (windowId: string, x: number, y: number, width: number, height: number): void => {
    ipcRenderer.send("anchoran:embed-bounds", windowId, x, y, width, height);
  },
  embedVisibility: (windowId: string, visible: boolean): void => {
    ipcRenderer.send("anchoran:embed-visibility", windowId, visible);
  },
  embedFocus: (windowId: string): void => {
    ipcRenderer.send("anchoran:embed-focus", windowId);
  },
  embedStop: (windowId: string): Promise<{ success: boolean }> => ipcRenderer.invoke("anchoran:embed-stop", windowId),
  onEmbedStatus: (callback: (status: unknown) => void): void => {
    ipcRenderer.on("anchoran:embed-status", (_e, status) => callback(status));
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
  trashMove: (paths: string[]): Promise<{ success: boolean; error?: string; ids: string[] }> =>
    ipcRenderer.invoke("anchoran:trash-move", paths),
  trashList: (): Promise<
    { id: string; originalPath: string; name: string; isDirectory: boolean; deletedAt: number }[]
  > => ipcRenderer.invoke("anchoran:trash-list"),
  trashRestore: (id: string): Promise<{ success: boolean; error?: string; restoredTo?: string }> =>
    ipcRenderer.invoke("anchoran:trash-restore", id),
  trashDeletePermanently: (id: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:trash-delete-permanently", id),
  trashEmpty: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke("anchoran:trash-empty"),
  onDriveConnected: (callback: (drive: string) => void): void => {
    ipcRenderer.on("anchoran:drive-connected", (_e, drive) => callback(drive));
  },
  onDriveDisconnected: (callback: (drive: string) => void): void => {
    ipcRenderer.on("anchoran:drive-disconnected", (_e, drive) => callback(drive));
  },
  fsReadBinary: (filePath: string): Promise<{ base64: string } | { error: string }> =>
    ipcRenderer.invoke("anchoran:fs-read-binary", filePath),
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
  fsOpenWith: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("anchoran:fs-open-with", filePath),
  fsShowInExplorer: (filePath: string): void => {
    ipcRenderer.send("anchoran:fs-show-in-explorer", filePath);
  },
});
