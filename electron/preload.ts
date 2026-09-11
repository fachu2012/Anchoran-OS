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

  exportData: (): Promise<{ success: boolean; path?: string }> => ipcRenderer.invoke("anchoran:export-data"),
  importData: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke("anchoran:import-data"),
  resetData: (): Promise<boolean> => ipcRenderer.invoke("anchoran:reset-data"),

  checkForUpdates: (): void => {
    ipcRenderer.invoke("anchoran:check-for-updates");
  },
  onUpdateStatus: (callback: (status: unknown) => void): void => {
    ipcRenderer.on("anchoran:update-status", (_e, status) => callback(status));
  },
  quitAndInstallUpdate: (): void => {
    ipcRenderer.send("anchoran:quit-and-install-update");
  },
});
