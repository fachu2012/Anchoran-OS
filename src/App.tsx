import { useEffect, useRef, useState } from "react";
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
// Side-effect only — starts the "recent settings changes" log tracking
// from boot, not only once Settings has been opened once.
import "@/theme/settingsChangeLogStore";
// Side-effect only — checks on boot whether the wallpaper Spotlight is
// due to rotate, rather than only ever checking once Settings opens.
import "@/theme/wallpaperSpotlightStore";
import { Onboarding } from "@/onboarding/Onboarding";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useAnchoranStartupAppsStore, startupAppsReady } from "@/core/anchoranStartupAppsStore";
import { useSystemModeStore } from "@/desktop/systemModeStore";
import { AnchoranFilePicker } from "@/core/AnchoranFilePicker";

const WELCOMED_KEY = "welcomed";

export default function App() {
  const [booted, setBooted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exitMode, setExitMode] = useState<ExitMode | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [updateReadyVersion, setUpdateReadyVersion] = useState<string | null>(null);
  const [updateTheaterVersion, setUpdateTheaterVersion] = useState<string | null>(null);
  const [changeToTheaterVersion, setChangeToTheaterVersion] = useState<string | null>(null);
  // undefined = still checking; null = this boot is not finishing an
  // update. Gates BootScreen's first mount so it never briefly renders
  // with the wrong (generic) status stages before this resolves.
  const [finishingUpdateVersion, setFinishingUpdateVersion] = useState<string | null | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingSaveImage, setPendingSaveImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const pushNotification = useNotificationStore((s) => s.push);

  // Global shortcuts (Windows key, Alt+Tab, PrintScreen…) are forwarded
  // here from the main process regardless of whether Anchoran is
  // locked — the lock screen is just a visual overlay on top of the
  // real desktop, so acting on them while locked used to open the
  // Launcher (or a window) behind the lock screen. Invisible, but its
  // search box still grabbed real keyboard focus away from the PIN
  // field, so typing your PIN silently typed into the hidden Launcher
  // instead. A ref (not `locked` state itself) so these IPC listeners
  // — registered once, with no "off" counterpart to call on cleanup —
  // aren't torn down and re-added every time the lock state flips.
  const lockedRef = useRef(false);
  useEffect(() => {
    lockedRef.current = locked;
    // Locking while the Launcher happens to already be open (e.g. the
    // inactivity auto-lock timer firing) would leave it — and the
    // keyboard focus inside it — sitting behind the lock screen too.
    if (locked) setLauncherOpen(false);
  }, [locked]);

  useEffect(() => {
    window.anchoran?.consumePendingUpdate().then(setFinishingUpdateVersion) ?? setFinishingUpdateVersion(null);

    window.anchoran?.onRequestExitConfirmation(() => setExitDialogOpen(true));
    // The Windows key is intercepted (where Windows allows it) by the
    // main process as a global shortcut and forwarded here to toggle
    // Anchoran's own Launcher — see electron/main.ts and project
    // instructions §11/§16 for the security scope of this behavior.
    // Ctrl+Alt+L is the reliable fallback, registered alongside it.
    window.anchoran?.onToggleLauncher(() => {
      if (lockedRef.current) return;
      setLauncherOpen((v) => !v);
    });

    // System Mode (see TODO.md / native/kioskhook): while it's on, the
    // Windows key and Alt+Tab are claimed system-wide by the native
    // helper instead of Explorer, and forwarded here — same Launcher
    // toggle as the line above, plus Anchoran's own window switcher
    // for Alt+Tab (the same one Ctrl+Tab already opens, see Desktop.tsx).
    window.anchoran?.onSystemModeKey((key) => {
      if (lockedRef.current) return;
      if (key === "WIN") setLauncherOpen((v) => !v);
      else if (key === "ALTTAB") useWindowStore.getState().cycleFocus(1);
    });

    // PrintScreen / Ctrl+Shift+S — opens Screenshot and starts the
    // capture immediately (see Screenshot.tsx's "anchoran-auto-capture"
    // listener); the short delay gives its lazily-loaded chunk time to
    // mount before that event fires.
    window.anchoran?.onTriggerScreenshot(() => {
      if (lockedRef.current) return;
      useWindowStore.getState().openApp("screenshot");
      setTimeout(() => window.dispatchEvent(new Event("anchoran-auto-capture")), 300);
    });

    // Browser's right-click → "Set as Wallpaper" / "Save Image As…" —
    // the actual image bytes are fetched in the main process (see
    // electron/main.ts), the renderer just applies/saves them.
    window.anchoran?.onSetImageAsWallpaper((dataUrl) => {
      usePreferencesStore.getState().setCustomWallpaper(dataUrl);
      usePreferencesStore.getState().setWallpaper("custom");
      pushNotification("Browser", "Applied as your desktop wallpaper.");
    });
    window.anchoran?.onSaveImageFromBrowser(({ dataUrl, name }) => {
      setPendingSaveImage({ dataUrl, name });
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

  // The Terminal's "lock"/"restart"/"shutdown"/"sleep" commands — the
  // exact same effect as their Power menu equivalents, just reachable
  // without leaving the keyboard.
  useEffect(() => {
    function onRequestLock() {
      if (booted) setLocked(true);
    }
    function onRequestRestart() {
      if (booted) setExitMode("restart");
    }
    function onRequestShutdown() {
      if (booted) setExitMode("shutdown");
    }
    function onRequestSleep() {
      if (booted) setExitMode("sleep");
    }
    // Settings' "Restart & install vX" button (About section) asks for
    // the same fullscreen update cinematic instead of quitting and
    // installing silently in place — see UpdateTheater below and its
    // onComplete, which is the only thing that's actually allowed to
    // call quitAndInstallUpdate().
    function onRequestUpdateTheater(e: Event) {
      const version = (e as CustomEvent<string>).detail;
      if (booted && version) {
        setUpdateReadyVersion(null);
        setUpdateTheaterVersion(version);
      }
    }
    // The Terminal's `anchoran changeto vX.Y.Z` asks for the same
    // cinematic too, once its own download has finished — see
    // TerminalConsole.tsx. A separate slot from the one above since its
    // onComplete calls a different IPC method (changeToInstall, not
    // quitAndInstallUpdate — changeto downloads a specific release
    // directly rather than going through electron-updater's own feed).
    function onRequestChangeToTheater(e: Event) {
      const version = (e as CustomEvent<string>).detail;
      if (booted && version) setChangeToTheaterVersion(version);
    }
    window.addEventListener("anchoran-request-lock", onRequestLock);
    window.addEventListener("anchoran-request-restart", onRequestRestart);
    window.addEventListener("anchoran-request-shutdown", onRequestShutdown);
    window.addEventListener("anchoran-request-sleep", onRequestSleep);
    window.addEventListener("anchoran-request-update-theater", onRequestUpdateTheater);
    window.addEventListener("anchoran-request-changeto-theater", onRequestChangeToTheater);
    return () => {
      window.removeEventListener("anchoran-request-lock", onRequestLock);
      window.removeEventListener("anchoran-request-restart", onRequestRestart);
      window.removeEventListener("anchoran-request-shutdown", onRequestShutdown);
      window.removeEventListener("anchoran-request-sleep", onRequestSleep);
      window.removeEventListener("anchoran-request-update-theater", onRequestUpdateTheater);
      window.removeEventListener("anchoran-request-changeto-theater", onRequestChangeToTheater);
    };
  }, [booted]);

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

    // Reopens whatever apps were set to launch with Anchoran itself —
    // see anchoranStartupAppsStore.ts. Windows exist right away even
    // while the lock screen is up, the same as a real OS restoring
    // your session before you've unlocked.
    startupAppsReady.then(() => {
      const { items } = useAnchoranStartupAppsStore.getState();
      for (const item of items) {
        const windowId = useWindowStore.getState().openApp(item.appId);
        if (item.minimized && windowId) useWindowStore.getState().minimizeWindow(windowId);
      }
    });

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
        {changeToTheaterVersion && (
          <UpdateTheater
            mode="update"
            targetVersion={changeToTheaterVersion}
            onComplete={() => window.anchoran?.changeToInstall()}
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
        {pendingSaveImage && (
          <AnchoranFilePicker
            mode="save"
            title="Save Image As"
            defaultName={pendingSaveImage.name}
            onCancel={() => setPendingSaveImage(null)}
            onConfirm={async (result) => {
              const image = pendingSaveImage;
              setPendingSaveImage(null);
              if (!("dir" in result) || !image || !window.anchoran) return;
              const write = await window.anchoran.fsWriteDataUrl(result.dir, result.name, image.dataUrl);
              pushNotification("Browser", "error" in write ? write.error : "Image saved.");
            }}
          />
        )}
      </div>
    </ThemeProvider>
  );
}
