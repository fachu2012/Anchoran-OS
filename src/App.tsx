import { useEffect, useState } from "react";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { BootScreen } from "@/boot/BootScreen";
import { Desktop } from "@/desktop/Desktop";
import { LockScreen } from "@/lock/LockScreen";
import { ExitConfirmDialog } from "@/power/ExitConfirmDialog";
import { ShutdownScreen, type ExitMode } from "@/power/ShutdownScreen";
import { UpdateReadyScreen } from "@/power/UpdateReadyScreen";
import { UpdateTheater } from "@/power/UpdateTheater";
import { useNotificationStore } from "@/notifications/notificationStore";
import { persistGet, persistSet } from "@/core/persist";
import { playLoginSound } from "@/core/sound";
import { recordUpdateIfVersionChanged } from "@/core/updateHistory";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { Onboarding } from "@/onboarding/Onboarding";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useSystemModeStore } from "@/desktop/systemModeStore";

const WELCOMED_KEY = "welcomed";

export default function App() {
  const [booted, setBooted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exitMode, setExitMode] = useState<ExitMode | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [updateReadyVersion, setUpdateReadyVersion] = useState<string | null>(null);
  const [updateTheaterVersion, setUpdateTheaterVersion] = useState<string | null>(null);
  // undefined = still checking; null = this boot is not finishing an
  // update. Gates BootScreen's first mount so it never briefly renders
  // with the wrong (generic) status stages before this resolves.
  const [finishingUpdateVersion, setFinishingUpdateVersion] = useState<string | null | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const pushNotification = useNotificationStore((s) => s.push);

  useEffect(() => {
    window.anchoran?.consumePendingUpdate().then(setFinishingUpdateVersion) ?? setFinishingUpdateVersion(null);

    window.anchoran?.onRequestExitConfirmation(() => setExitDialogOpen(true));
    // The Windows key is intercepted (where Windows allows it) by the
    // main process as a global shortcut and forwarded here to toggle
    // Anchoran's own Launcher — see electron/main.ts and project
    // instructions §11/§16 for the security scope of this behavior.
    // Ctrl+Alt+L is the reliable fallback, registered alongside it.
    window.anchoran?.onToggleLauncher(() => setLauncherOpen((v) => !v));

    // System Mode (see TODO.md / native/kioskhook): while it's on, the
    // Windows key and Alt+Tab are claimed system-wide by the native
    // helper instead of Explorer, and forwarded here — same Launcher
    // toggle as the line above, plus Anchoran's own window switcher
    // for Alt+Tab (the same one Ctrl+Tab already opens, see Desktop.tsx).
    window.anchoran?.onSystemModeKey((key) => {
      if (key === "WIN") setLauncherOpen((v) => !v);
      else if (key === "ALTTAB") useWindowStore.getState().cycleFocus(1);
    });

    // PrintScreen / Ctrl+Shift+S — opens Screenshot and starts the
    // capture immediately (see Screenshot.tsx's "anchoran-auto-capture"
    // listener); the short delay gives its lazily-loaded chunk time to
    // mount before that event fires.
    window.anchoran?.onTriggerScreenshot(() => {
      useWindowStore.getState().openApp("screenshot");
      setTimeout(() => window.dispatchEvent(new Event("anchoran-auto-capture")), 300);
    });

    // Tells the user when neither shortcut could be registered at all
    // (some other app already owns both) instead of them silently not
    // working — the dock/taskbar Launcher button always still works.
    window.anchoran?.onShortcutStatus(({ fallbackRegistered }) => {
      if (!fallbackRegistered) {
        pushNotification(
          "Launcher shortcut",
          "Ctrl+Alt+L is already used by another app on this PC. Open the Launcher from the dock instead."
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

    // System Mode now starts on by default every launch (not
    // persisted — a fresh, deliberate start each time, same safety
    // model as before, just flipped to auto-on instead of requiring a
    // manual toggle in Settings each session). Turning it off in
    // Settings only lasts for the current session.
    useSystemModeStore.getState().start();

    // First-ever boot after installing: the welcome wizard (username,
    // PIN, avatar, wallpaper) takes the place of both the lock screen
    // and the generic "Welcome" toast this once — see onOnboardingDone.
    if (!usePreferencesStore.getState().onboardingComplete) {
      setShowOnboarding(true);
      return;
    }

    // Anchoran always starts locked, like a real PC — with a PIN set,
    // LockScreen requires it; without one, it unlocks on any input.
    setLocked(true);

    const alreadyWelcomed = await persistGet("config", WELCOMED_KEY, false);
    if (!alreadyWelcomed) {
      persistSet("config", WELCOMED_KEY, true);
      pushNotification("Welcome", "This is Anchoran OS. Press Ctrl+Alt+L or use the dock to open the Launcher.");
    }
  }

  // Auto-lock after N minutes of inactivity (mouse/keyboard/pointer),
  // configurable in Settings → Users. Only meaningful once a PIN is
  // set — otherwise "locking" doesn't protect anything and would just
  // be an unwanted screen interruption.
  const autoLockMinutes = usePreferencesStore((s) => s.autoLockMinutes);
  const hasLockPin = usePreferencesStore((s) => !!s.lockPin);
  useEffect(() => {
    if (!booted || locked || !hasLockPin || autoLockMinutes <= 0) return;
    let timer: number;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), autoLockMinutes * 60 * 1000);
    };
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "pointerdown", "wheel"];
    events.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [booted, locked, hasLockPin, autoLockMinutes]);

  function onOnboardingDone() {
    setShowOnboarding(false);
    persistSet("config", WELCOMED_KEY, true);
    // No lock screen right after setup — the user just entered their
    // PIN moments ago; re-locking immediately would be redundant.
  }

  function handleExitComplete() {
    // Preferences and the virtual filesystem are already persisted
    // continuously (see preferencesStore / fs.ts), so there is no
    // separate "save" step needed before any of these. Anchoran has no
    // long-running internal app processes beyond its own React windows.
    if (exitMode === "shutdown") window.anchoran?.confirmExit();
    else if (exitMode === "restart") window.anchoran?.restart();
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

        {!booted &&
          (finishingUpdateVersion !== undefined ? (
            <BootScreen onDone={enterDesktop} finishingUpdateVersion={finishingUpdateVersion} />
          ) : (
            // Briefly shown while checking whether this boot is
            // finishing an update — avoids a flash of the desktop
            // underneath before BootScreen itself takes over.
            <div style={{ position: "absolute", inset: 0, background: "#000000", zIndex: 2000 }} />
          ))}
        {showOnboarding && <Onboarding onComplete={onOnboardingDone} />}
        {locked && <LockScreen onUnlock={() => setLocked(false)} />}
        {updateReadyVersion && !exitMode && !updateTheaterVersion && (
          <UpdateReadyScreen
            version={updateReadyVersion}
            onLater={() => setUpdateReadyVersion(null)}
            onInstallNow={() => {
              setUpdateTheaterVersion(updateReadyVersion);
              setUpdateReadyVersion(null);
            }}
          />
        )}
        {updateTheaterVersion && (
          <UpdateTheater
            mode="update"
            targetVersion={updateTheaterVersion}
            onComplete={() => window.anchoran?.quitAndInstallUpdate()}
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
