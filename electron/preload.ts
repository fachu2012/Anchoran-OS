import { contextBridge, ipcRenderer } from "electron";

/**
 * The only surface the renderer (React UI) is allowed to reach into
 * the host OS through. Kept intentionally small: version info, exit/
 * restart flow, and the Windows-key -> Launcher signal.
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
});
