import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("anchoranSetup", {
  ready: () => ipcRenderer.send("setup:ready"),
  onStage: (cb: (stage: string) => void) => {
    ipcRenderer.on("setup:stage", (_e, stage: string) => cb(stage));
  },
  onError: (cb: (message: string) => void) => {
    ipcRenderer.on("setup:error", (_e, message: string) => cb(message));
  },
  onLaunchFallback: (cb: () => void) => {
    ipcRenderer.on("setup:launch-fallback", () => cb());
  },
});
