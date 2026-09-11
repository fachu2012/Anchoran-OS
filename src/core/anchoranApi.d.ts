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
    importMedia: () => Promise<{ dataUrl: string; fileName: string } | { error: string } | null>;

    exportData: () => Promise<{ success: boolean; path?: string }>;
    importData: () => Promise<{ success: boolean; error?: string }>;
    resetData: () => Promise<boolean>;
    saveAndOpenFile: (fileName: string, base64: string) => Promise<{ success: boolean; error?: string }>;
    getCaptureSources: () => Promise<{ id: string; name: string; thumbnailDataUrl: string }[]>;
    pickZipFile: () => Promise<{ base64: string; fileName: string } | { error: string } | null>;
    pickFolder: (title: string) => Promise<string | null>;
    showWebviewContextMenu: (
      webContentsId: number,
      x: number,
      y: number,
      params: { isEditable: boolean; selectionText: string; linkURL: string; srcURL: string; hasImageContents: boolean }
    ) => void;
    readLog: () => Promise<string[]>;

    checkForUpdates: () => void;
    onUpdateStatus: (callback: (status: AnchoranUpdateStatus) => void) => void;
    quitAndInstallUpdate: () => void;
    consumePendingUpdate: () => Promise<string | null>;

    systemModeStart: () => Promise<{ success: boolean; error?: string }>;
    systemModeStop: () => Promise<{ success: boolean }>;
    systemModeStatus: () => Promise<{ running: boolean; supported: boolean }>;
    onSystemModeKey: (callback: (key: "WIN" | "ALTTAB") => void) => void;
    onSystemModeStatusChange: (callback: (running: boolean) => void) => void;

    fsSpecialFolders: () => Promise<Record<"home" | "desktop" | "documents" | "downloads" | "pictures" | "music" | "videos", string>>;
    fsListDrives: () => Promise<string[]>;
    fsListDir: (
      dirPath: string
    ) => Promise<{ entries: FsEntry[] } | { error: string }>;
    fsReadTextFile: (filePath: string) => Promise<{ content: string } | { error: string }>;
    fsReadImageFile: (filePath: string) => Promise<{ dataUrl: string } | { error: string }>;
    fsIsTextFile: (filePath: string) => Promise<boolean>;
    fsWriteTextFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
    fsCreateFolder: (parentPath: string, name: string) => Promise<{ path: string } | { error: string }>;
    fsCreateFile: (parentPath: string, name: string, content?: string) => Promise<{ path: string } | { error: string }>;
    fsWriteDataUrl: (parentPath: string, name: string, dataUrl: string) => Promise<{ path: string } | { error: string }>;
    fsRename: (oldPath: string, newName: string) => Promise<{ path: string } | { error: string }>;
    fsDelete: (paths: string[]) => Promise<{ success: boolean; error?: string }>;
    fsCopy: (sourcePaths: string[], destDir: string) => Promise<{ success: boolean; error?: string }>;
    fsMove: (sourcePaths: string[], destDir: string) => Promise<{ success: boolean; error?: string }>;
    fsOpenPath: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    fsOpenWith: (filePath: string) => void;
    fsShowInExplorer: (filePath: string) => void;

    pickOpenTextFile: () => Promise<{ path: string; content: string } | { error: string } | null>;
    pickSaveTextFile: (defaultName: string, content: string) => Promise<{ path: string } | { error: string } | null>;
  }

  interface FsEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modifiedAt: number;
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
