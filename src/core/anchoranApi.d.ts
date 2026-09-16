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
    /** Reports a fatal renderer-side crash (caught by the top-level catch in src/main.tsx) to the main process, which forwards it to the crash watchdog. */
    rendererFatalError: (message: string) => void;
    /** "Restart Anchoran" on the crash screen. */
    crashRestart: () => void;
    /** "Force close Anchoran" on the crash screen. */
    crashForceClose: () => void;
    /** Admin Terminal's "anchoran testcrash <n>" — deliberately triggers one of several real failure modes to test the watchdog end-to-end. */
    testCrash: (type: number) => Promise<{ success: boolean; note?: string; error?: string }>;
    restart: () => void;
    onRequestExitConfirmation: (callback: () => void) => void;
    onToggleLauncher: (callback: () => void) => void;
    onTriggerScreenshot: (callback: () => void) => void;
    onShortcutStatus: (callback: (status: { superRegistered: boolean; fallbackRegistered: boolean }) => void) => void;
    getSystemInfo: () => Promise<AnchoranSystemInfo>;
    configGet: (key: string) => Promise<unknown>;
    configSet: (key: string, value: unknown) => Promise<boolean>;
    dataGet: (key: string) => Promise<unknown>;
    dataSet: (key: string, value: unknown) => Promise<boolean>;
    logError: (scope: string, message: string) => void;
    getDisplays: () => Promise<{ id: number; label: string; isPrimary: boolean }[]>;
    moveToDisplay: (displayId: number) => void;
    exportData: () => Promise<{ success: boolean; path?: string }>;
    importData: () => Promise<{ success: boolean; error?: string }>;
    resetData: () => Promise<boolean>;
    saveAndOpenFile: (fileName: string, base64: string) => Promise<{ success: boolean; error?: string }>;
    getCaptureSources: () => Promise<{ id: string; name: string; thumbnailDataUrl: string }[]>;
    copyImageToClipboard: (dataUrl: string) => Promise<{ success: boolean; error?: string }>;
    openRecycleBin: () => void;
    emptyRecycleBin: () => Promise<{ success: boolean; error?: string }>;
    clearCache: () => Promise<{ success: boolean; error?: string; freedBytes?: number }>;
    openOsk: () => void;
    openNarrator: () => void;
    listStartupItems: () => Promise<{ name: string; command: string; exists: boolean }[]>;
    removeStartupItem: (name: string) => Promise<{ success: boolean; error?: string }>;
    listProcesses: () => Promise<{ pid: number; parentPid: number; name: string }[]>;
    killProcess: (pid: number) => Promise<{ success: boolean; error?: string }>;
    getDiskUsage: () => Promise<{ drives: { caption: string; free: number; total: number }[] }>;
    getFolderSizes: (
      paths: { label: string; path: string }[]
    ) => Promise<{ label: string; path: string; size: number }[]>;
    showWebviewContextMenu: (
      webContentsId: number,
      x: number,
      y: number,
      params: { isEditable: boolean; selectionText: string; linkURL: string; srcURL: string; hasImageContents: boolean }
    ) => void;
    onSetImageAsWallpaper: (callback: (dataUrl: string) => void) => void;
    onSaveImageFromBrowser: (callback: (payload: { dataUrl: string; name: string }) => void) => void;

    onDownloadUpdate: (
      callback: (record: {
        id: string;
        fileName: string;
        path: string;
        receivedBytes: number;
        totalBytes: number;
        state: "progressing" | "completed" | "cancelled" | "interrupted";
      }) => void
    ) => void;
    openDownload: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    showDownloadInExplorer: (filePath: string) => void;
    setTrackerBlock: (enabled: boolean) => Promise<{ success: boolean }>;
    getTrackerBlockCount: () => Promise<number>;
    setBetaChannel: (enabled: boolean) => Promise<{ success: boolean }>;
    getBetaChannel: () => Promise<boolean>;
    getUpdateFailureInfo: () => Promise<{ failed: boolean; lastKnownGoodVersion: string | null }>;
    bootComplete: () => Promise<{ success: boolean }>;
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
    savePageComplete: (
      webContentsId: number,
      targetDir: string,
      fileName: string
    ) => Promise<{ success: boolean; error?: string; path?: string }>;
    fetchImageAsDataUrl: (url: string) => Promise<{ dataUrl: string } | { error: string }>;
    clearBrowserData: () => Promise<{ success: boolean; error?: string }>;

    regQuery: (key: string) => Promise<{ success: boolean; output?: string; error?: string }>;
    pingHost: (host: string) => Promise<{ success: boolean; output: string }>;
    restartExplorer: () => Promise<{ success: boolean; error?: string }>;
    readLog: () => Promise<string[]>;

    checkForUpdates: () => void;
    onUpdateStatus: (callback: (status: AnchoranUpdateStatus) => void) => void;
    quitAndInstallUpdate: () => void;
    consumePendingUpdate: () => Promise<string | null>;

    pluginInstall: (pluginId: string, entryUrl: string, manifest?: { title?: string; icon?: string; version?: string }) => Promise<{ success: boolean; error?: string }>;
    pluginUninstall: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
    pluginIsInstalled: (pluginId: string) => Promise<boolean>;
    pluginEntryPath: (pluginId: string) => Promise<string | null>;
    /** Every currently-installed plugin's {id, title, icon, version} — what lets the Launcher list downloaded Webstore plugins alongside Anchoran's own bundled apps, and lets an auto-update check know whether one is outdated. `version` is absent for a plugin installed before this field existed. See electron/main.ts's anchoran:plugin-list-installed. */
    pluginListInstalled: () => Promise<{ id: string; title: string; icon: string; version?: string }[]>;
    /** Refreshes a plugin's local manifest.json (title/icon/version, no code touched) — used to backfill a plugin installed before manifest.json existed. See electron/main.ts's anchoran:plugin-set-manifest. */
    pluginSetManifest: (pluginId: string, manifest: { title?: string; icon?: string; version?: string }) => Promise<{ success: boolean; error?: string }>;

    deleteLocalDataForDowngrade: () => Promise<{ success: boolean; error?: string }>;
    changeToDownload: (version: string) => Promise<{ success: boolean; error?: string }>;
    changeToInstall: () => Promise<{ success: boolean; error?: string }>;
    onChangeToStatus: (callback: (status: AnchoranChangeToStatus) => void) => void;

    systemModeStart: () => Promise<{ success: boolean; error?: string }>;
    systemModeStop: () => Promise<{ success: boolean }>;
    systemModeStatus: () => Promise<{ running: boolean; supported: boolean }>;
    onSystemModeKey: (callback: (key: "WIN" | "ALTTAB") => void) => void;
    onSystemModeStatusChange: (callback: (running: boolean) => void) => void;
    onSystemModeFailed: (callback: (reason: string) => void) => void;

    embedStart: (windowId: string, exePath: string) => Promise<{ success: boolean; error?: string }>;
    embedBounds: (windowId: string, x: number, y: number, width: number, height: number) => void;
    embedVisibility: (windowId: string, visible: boolean) => void;
    embedFocus: (windowId: string) => void;
    embedStop: (windowId: string) => Promise<{ success: boolean }>;
    onEmbedStatus: (callback: (status: AnchoranEmbedStatus) => void) => void;

    fsSpecialFolders: () => Promise<Record<"home" | "desktop" | "documents" | "downloads" | "pictures" | "music" | "videos", string>>;
    fsListDrives: () => Promise<string[]>;
    fsListDir: (
      dirPath: string
    ) => Promise<{ entries: FsEntry[] } | { error: string }>;
    fsReadTextFile: (filePath: string) => Promise<{ content: string } | { error: string }>;
    fsReadImageFile: (filePath: string) => Promise<{ dataUrl: string } | { error: string }>;
    fsIsTextFile: (filePath: string) => Promise<boolean>;
    runCode: (
      filePath: string
    ) => Promise<
      | { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }
      | { unsupported: true }
      | { error: string }
    >;
    onDriveConnected: (callback: (drive: string) => void) => void;
    onDriveDisconnected: (callback: (drive: string) => void) => void;
    trashMove: (paths: string[]) => Promise<{ success: boolean; error?: string; ids: string[] }>;
    trashList: () => Promise<{ id: string; originalPath: string; name: string; isDirectory: boolean; deletedAt: number }[]>;
    trashRestore: (id: string) => Promise<{ success: boolean; error?: string; restoredTo?: string }>;
    trashDeletePermanently: (id: string) => Promise<{ success: boolean; error?: string }>;
    trashEmpty: () => Promise<{ success: boolean; error?: string }>;
    fsReadBinary: (filePath: string) => Promise<{ base64: string } | { error: string }>;
    fsWriteTextFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
    fsCreateFolder: (parentPath: string, name: string) => Promise<{ path: string } | { error: string }>;
    fsCreateFile: (parentPath: string, name: string, content?: string) => Promise<{ path: string } | { error: string }>;
    fsWriteDataUrl: (parentPath: string, name: string, dataUrl: string) => Promise<{ path: string } | { error: string }>;
    fsRename: (oldPath: string, newName: string) => Promise<{ path: string } | { error: string }>;
    fsDelete: (paths: string[]) => Promise<{ success: boolean; error?: string }>;
    fsCopy: (sourcePaths: string[], destDir: string) => Promise<{ success: boolean; error?: string }>;
    fsMove: (sourcePaths: string[], destDir: string) => Promise<{ success: boolean; error?: string }>;
    fsOpenPath: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    fsOpenWith: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    fsShowInExplorer: (filePath: string) => void;
  }

  interface FsEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modifiedAt: number;
    createdAt: number;
  }

  type AnchoranUpdateStatus =
    | { state: "checking" }
    | { state: "available"; version: string }
    | { state: "not-available" }
    | { state: "downloading"; percent: number }
    | { state: "downloaded"; version: string }
    | { state: "error"; message: string };

  type AnchoranChangeToStatus =
    | { state: "downloading"; percent: number }
    | { state: "downloaded" }
    | { state: "installing" }
    | { state: "error"; message: string };

  type AnchoranEmbedStatus =
    | { windowId: string; state: "embedded" }
    | { windowId: string; state: "closed" }
    | { windowId: string; state: "error"; message: string };

  interface Window {
    anchoran?: AnchoranBridge;
  }
}
