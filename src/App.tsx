import { useEffect, useState } from "react";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { BootScreen } from "@/boot/BootScreen";
import { Desktop } from "@/desktop/Desktop";
import { LockScreen } from "@/lock/LockScreen";
import { ExitConfirmDialog } from "@/power/ExitConfirmDialog";
import { ShutdownScreen, type ExitMode } from "@/power/ShutdownScreen";
import { UpdateReadyScreen } from "@/power/UpdateReadyScreen";
import { useNotificationStore } from "@/notifications/notificationStore";
import { persistGet, persistSet } from "@/core/persist";
import { playLoginSound } from "@/core/sound";
import { recordUpdateIfVersionChanged } from "@/core/updateHistory";

const WELCOMED_KEY = "welcomed";

export default function App() {
  const [booted, setBooted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exitMode, setExitMode] = useState<ExitMode | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [updateReadyVersion, setUpdateReadyVersion] = useState<string | null>(null);
  const pushNotification = useNotificationStore((s) => s.push);

  useEffect(() => {
    window.anchoran?.onRequestExitConfirmation(() => setExitDialogOpen(true));
    // The Windows key is intercepted (where Windows allows it) by the
    // main process as a global shortcut and forwarded here to toggle
    // Anchoran's own Launcher — see electron/main.ts and project
    // instructions §11/§16 for the security scope of this behavior.
    // Ctrl+Win is the reliable fallback, registered alongside it.
    window.anchoran?.onToggleLauncher(() => setLauncherOpen((v) => !v));

    // Tells the user when neither shortcut could be registered at all
    // (some other app already owns both) instead of them silently not
    // working — the dock/taskbar Launcher button always still works.
    window.anchoran?.onShortcutStatus(({ fallbackRegistered }) => {
      if (!fallbackRegistered) {
        pushNotification(
          "Launcher shortcut",
          "Ctrl+Win is already used by another app on this PC. Open the Launcher from the dock instead."
        );
      }
    });

    // Detects an update landed (any mechanism) by comparing this boot's
    // version to the last one recorded — see core/updateHistory.ts.
    recordUpdateIfVersionChanged();

    // A background update check (startup or triggered from the
    // Terminal/Settings) finishes downloading — offer the same
    // fullscreen "ready to install" moment regardless of where the
    // check was started from.
    window.anchoran?.onUpdateStatus((status) => {
      if (status.state === "downloaded") setUpdateReadyVersion(status.version);
    });
  }, []);

  async function enterDesktop() {
    setBooted(true);
    playLoginSound();

    // Anchoran always starts locked, like a real PC — with a PIN set,
    // LockScreen requires it; without one, it unlocks on any input.
    setLocked(true);

    const alreadyWelcomed = await persistGet("config", WELCOMED_KEY, false);
    if (!alreadyWelcomed) {
      persistSet("config", WELCOMED_KEY, true);
      pushNotification("Welcome", "This is Anchoran OS. Press Ctrl+Win or use the dock to open the Launcher.");
    }
  }

  function handleExitComplete() {
    // Preferences and the virtual filesystem are already persisted
    // continuously (see preferencesStore / fs.ts), so there is no
    // separate "save" step needed before any of these. Anchoran has no
    // long-running internal app processes beyond its own React windows.
    if (exitMode === "shutdown") window.anchoran?.confirmExit();
    else if (exitMode === "restart") window.anchoran?.restart();
    else if (exitMode === "update") window.anchoran?.quitAndInstallUpdate();
    else if (exitMode === "sleep") {
      setLocked(true);
      setExitMode(null);
    }
  }

  return (
    <ThemeProvider>
      <div style={{ position: "relative", height: "100%", width: "100%" }}>
        <Desktop
          onLock={() => setLocked(true)}
          onSleep={() => setExitMode("sleep")}
          onShutDown={() => setExitMode("shutdown")}
          onRestart={() => setExitMode("restart")}
          launcherOpen={launcherOpen}
          setLauncherOpen={setLauncherOpen}
        />

        {!booted && <BootScreen onDone={enterDesktop} />}
        {locked && <LockScreen onUnlock={() => setLocked(false)} />}
        {updateReadyVersion && !exitMode && (
          <UpdateReadyScreen
            version={updateReadyVersion}
            onLater={() => setUpdateReadyVersion(null)}
            onInstallNow={() => {
              setUpdateReadyVersion(null);
              setExitMode("update");
            }}
          />
        )}
        {exitMode && <ShutdownScreen mode={exitMode} onComplete={handleExitComplete} />}
        {exitDialogOpen && (
          <ExitConfirmDialog
            onCancel={() => setExitDialogOpen(false)}
            onExit={() => {
              setExitDialogOpen(false);
              setExitMode("shutdown");
            }}
          />
        )}
      </div>
    </ThemeProvider>
  );
}
