export {};

interface AnchoranSystemInfo {
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
 * The narrow bridge exposed by electron/preload.ts. This is the only
 * way the renderer (React UI) is allowed to talk to the host process.
 */
declare global {
  interface AnchoranBridge {
    getVersion: () => Promise<string>;
    confirmExit: () => void;
    restart: () => void;
    onRequestExitConfirmation: (callback: () => void) => void;
    onToggleLauncher: (callback: () => void) => void;
    onShortcutStatus: (callback: (status: { superRegistered: boolean; fallbackRegistered: boolean }) => void) => void;
    getSystemInfo: () => Promise<AnchoranSystemInfo>;
    configGet: (key: string) => Promise<unknown>;
    configSet: (key: string, value: unknown) => Promise<boolean>;
    dataGet: (key: string) => Promise<unknown>;
    dataSet: (key: string, value: unknown) => Promise<boolean>;
    logError: (scope: string, message: string) => void;
    getDisplays: () => Promise<{ id: number; label: string; isPrimary: boolean }[]>;
    moveToDisplay: (displayId: number) => void;
    importImage: () => Promise<{ dataUrl: string; fileName: string } | { error: string } | null>;

    exportData: () => Promise<{ success: boolean; path?: string }>;
    importData: () => Promise<{ success: boolean; error?: string }>;
    resetData: () => Promise<boolean>;

    checkForUpdates: () => void;
    onUpdateStatus: (callback: (status: AnchoranUpdateStatus) => void) => void;
    quitAndInstallUpdate: () => void;
    consumePendingUpdate: () => Promise<string | null>;
  }

  type AnchoranUpdateStatus =
    | { state: "checking" }
    | { state: "available"; version: string }
    | { state: "not-available" }
    | { state: "downloading"; percent: number }
    | { state: "downloaded"; version: string }
    | { state: "error"; message: string };

  interface Window {
    anchoran?: AnchoranBridge;
  }
}
