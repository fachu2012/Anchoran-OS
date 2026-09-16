import { useEffect, useRef, useState } from "react";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { BootScreen } from "@/boot/BootScreen";
import { BootConfirmGate } from "@/boot/BootConfirmGate";
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
import { useUpdateAvailableStore } from "@/core/updateAvailableStore";
import { useAnchoranStartupAppsStore, startupAppsReady } from "@/core/anchoranStartupAppsStore";
import { preloadFrequentApps } from "@/core/preloadFrequentApps";
import { useSystemModeStore } from "@/desktop/systemModeStore";
import { AnchoranFilePicker } from "@/core/AnchoranFilePicker";
import { useProfilesStore } from "@/core/profilesStore";
import { DeleteOwnProfileConfirm } from "@/applications/settings/DeleteOwnProfileConfirm";

const WELCOMED_KEY = "welcomed";

export default function App() {
  // Fullscreen y/n confirmation, before anything else in the app even
  // mounts — see BootConfirmGate's own header comment for why this
  // replaced a Settings toggle: starting Anchoran now also takes over
  // the whole display and hides/throttles every other Windows app, so
  // it's asked in plain terms every single launch instead of set once
  // and forgotten. Deliberately not persisted.
  const [startupConfirmed, setStartupConfirmed] = useState(false);
  // A deliberate, uniform final beat for every real "close Anchoran
  // entirely" path (the normal desktop Shut down button, after its own
  // ShutdownScreen animation finishes; anything with no animation of
  // its own, like a force-close — this IS that path's whole visible
  // exit) — a plain black screen for exactly 2 seconds, then the real
  // process exit. Every genuine full-exit trigger should call
  // triggerDramaticExit() below instead of window.anchoran.confirmExit()
  // directly, so this beat can never be skipped by any one path.
  const [exitingBlackScreen, setExitingBlackScreen] = useState(false);
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
  const [deletingOwnProfileId, setDeletingOwnProfileId] = useState<string | null>(null);
  const deletingOwnProfile = useProfilesStore((s) => s.profiles.find((p) => p.id === deletingOwnProfileId));
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

    // The "started successfully" check below only covers a successful
    // *spawn* — the native helper can still fail a moment later (e.g.
    // its keyboard hook install) and exit on its own, after that first
    // check already passed. This is the only place that failure ever
    // becomes visible, since nothing else polls the helper's liveness.
    window.anchoran?.onSystemModeFailed((reason) => {
      pushNotification("Desktop takeover stopped working", `The Windows key, Alt+Tab, and hiding other apps won't work this session: ${reason}`);
    });

    // PrintScreen / Ctrl+Shift+S — Screenshot moved out to the
    // "image-tools" Webstore plugin (see CHANGELOG's Anchoran App SDK
    // migration), so this no longer opens a bundled app directly. If
    // the user has installed it, opens straight into it via PluginHost
    // — this global hotkey is exactly the kind of thing Anchoran can
    // still wire up to a plugin window by id, even though the app
    // itself isn't bundled anymore. If it isn't installed, points the
    // user at the Webstore instead of silently doing nothing.
    window.anchoran?.onTriggerScreenshot(async () => {
      if (lockedRef.current) return;
      const installed = await window.anchoran?.pluginIsInstalled("image-tools");
      if (installed) {
        useWindowStore.getState().openApp("pluginHost", { pluginId: "image-tools", title: "Image Tools" });
      } else {
        pushNotification("Screenshot", 'Install "Image Tools" from the Webstore to use the screenshot shortcut.');
      }
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
      // A later check coming back "not-available" (e.g. after toggling
      // Insider Preview updates off, when the previously downloaded
      // build was an I.P.U. one and no newer stable release exists)
      // means whatever was downloaded before is no longer the right
      // thing to offer — without this, the fullscreen "ready to
      // install" prompt and its taskbar/Settings counterpart could keep
      // showing a stale update indefinitely alongside a fresh "up to
      // date" message, which is exactly the contradiction it looks
      // like.
      else if (status.state === "not-available") setUpdateReadyVersion(null);
      // Keeps a persistent taskbar indicator in sync with the real
      // updater lifecycle, regardless of which screen triggered the
      // check — see updateAvailableStore.ts / Taskbar.tsx.
      if (status.state === "available") useUpdateAvailableStore.getState().set("available", status.version);
      else if (status.state === "downloading") useUpdateAvailableStore.setState({ status: "downloading" });
      else if (status.state === "downloaded") useUpdateAvailableStore.getState().set("downloaded", status.version);
      else if (status.state === "not-available") useUpdateAvailableStore.getState().set("none");
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
    // Settings → Users' "Delete" on the profile you're actually signed
    // in as right now — rendered here, not inside Settings' own window,
    // so it's a true full-desktop takeover like the update-ready screen
    // above, not confined to the Settings window's bounds.
    function onRequestDeleteOwnProfile(e: Event) {
      const profileId = (e as CustomEvent<string>).detail;
      if (booted && profileId) setDeletingOwnProfileId(profileId);
    }
    window.addEventListener("anchoran-request-lock", onRequestLock);
    window.addEventListener("anchoran-request-restart", onRequestRestart);
    window.addEventListener("anchoran-request-shutdown", onRequestShutdown);
    window.addEventListener("anchoran-request-sleep", onRequestSleep);
    window.addEventListener("anchoran-request-update-theater", onRequestUpdateTheater);
    window.addEventListener("anchoran-request-changeto-theater", onRequestChangeToTheater);
    window.addEventListener("anchoran-request-delete-own-profile", onRequestDeleteOwnProfile);
    return () => {
      window.removeEventListener("anchoran-request-lock", onRequestLock);
      window.removeEventListener("anchoran-request-restart", onRequestRestart);
      window.removeEventListener("anchoran-request-shutdown", onRequestShutdown);
      window.removeEventListener("anchoran-request-sleep", onRequestSleep);
      window.removeEventListener("anchoran-request-update-theater", onRequestUpdateTheater);
      window.removeEventListener("anchoran-request-changeto-theater", onRequestChangeToTheater);
      window.removeEventListener("anchoran-request-delete-own-profile", onRequestDeleteOwnProfile);
    };
  }, [booted]);

  async function enterDesktop() {
    setBooted(true);
    playLoginSound();

    // Confirms to the main process that this launch actually reached
    // a working desktop — clears the update-failure health check (see
    // electron/main.ts's anchoran:boot-complete). Reaching this call
    // at all, without having crashed first, is the real signal.
    window.anchoran?.bootComplete();
    window.anchoran?.getUpdateFailureInfo().then((info) => {
      if (!info.failed || !info.lastKnownGoodVersion) return;
      pushNotification(
        "Anchoran",
        `The update to this version didn't start cleanly last time. v${info.lastKnownGoodVersion} is the last version known to work.`,
        {
          label: `Reinstall v${info.lastKnownGoodVersion}`,
          onClick: () =>
            window.anchoran?.openExternal(
              `https://github.com/fachu2012/Anchoran-OS/releases/download/v${info.lastKnownGoodVersion}/AnchoranOS-Setup-${info.lastKnownGoodVersion}.exe`
            ),
        }
      );
    });

    // System Mode is unconditional now — no Settings toggle, no
    // Terminal command, nothing to turn it off with. The user already
    // explicitly agreed to this exact session (BootConfirmGate, before
    // any of this even mounted) — starting it here just carries that
    // through into the real desktop.
    //
    // A real, previously-silent gap: if kioskhook fails to start at all
    // (missing .exe, a spawn error, …), nothing ever surfaced that —
    // the old Settings → System Mode section used to show
    // useSystemModeStore's own `error` field, but nothing replaced that
    // once that whole section was removed when this became
    // unconditional. The Windows key/Alt+Tab (and the desktop takeover)
    // would then just silently not work, indistinguishable from a bug
    // in kioskhook's own logic — worth ruling out with a real,
    // visible notification instead of guessing blind.
    useSystemModeStore.getState().start()
      .then(() => {
        const { error } = useSystemModeStore.getState();
        if (error) {
          pushNotification("Desktop takeover couldn't start", `The Windows key, Alt+Tab, and hiding other apps won't work this session: ${error}`);
        }
      })
      .catch((err) => {
        pushNotification("Desktop takeover couldn't start", err instanceof Error ? err.message : String(err));
      });

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

    // Preloads whichever apps are actually opened most — a few
    // seconds after boot, well clear of the startup-app windows and
    // the welcome notification above, so it never competes with them
    // for the network/disk.
    setTimeout(() => preloadFrequentApps(), 4000);

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
    if (exitMode === "shutdown") triggerDramaticExit();
    else if (exitMode === "restart") window.anchoran?.restart();
    else if (exitMode === "sleep") {
      setLocked(true);
      setExitMode(null);
    }
  }

  function triggerDramaticExit() {
    setExitingBlackScreen(true);
    setTimeout(() => window.anchoran?.confirmExit(), 2000);
  }

  if (exitingBlackScreen) {
    return <div style={{ position: "fixed", inset: 0, background: "#000" }} />;
  }

  if (!startupConfirmed) {
    return <BootConfirmGate onConfirm={() => setStartupConfirmed(true)} />;
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
        {deletingOwnProfile && (
          <DeleteOwnProfileConfirm
            profile={deletingOwnProfile}
            onCancel={() => setDeletingOwnProfileId(null)}
            onConfirm={() => {
              useProfilesStore.getState().deleteProfile(deletingOwnProfile.id);
              setDeletingOwnProfileId(null);
              // Never silently land you in whichever profile happened to
              // be next — switching profiles only ever happens from the
              // lock screen, matching Settings → Users' own stated rule.
              setLocked(true);
            }}
          />
        )}
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
