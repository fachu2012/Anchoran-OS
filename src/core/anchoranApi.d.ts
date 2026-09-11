export {};

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
  }

  interface Window {
    anchoran?: AnchoranBridge;
  }
}
