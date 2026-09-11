import { useEffect, useState } from "react";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { BootScreen } from "@/boot/BootScreen";
import { Desktop } from "@/desktop/Desktop";
import { LockScreen } from "@/lock/LockScreen";
import { ExitConfirmDialog } from "@/power/ExitConfirmDialog";
import { useNotificationStore } from "@/notifications/notificationStore";

type SessionState = "booting" | "active" | "locked";

const WELCOMED_KEY = "anchoran.welcomed.v1";

export default function App() {
  const [session, setSession] = useState<SessionState>("booting");
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const pushNotification = useNotificationStore((s) => s.push);

  useEffect(() => {
    window.anchoran?.onRequestExitConfirmation(() => setExitDialogOpen(true));
    // The Windows key is intercepted (where Windows allows it) by the
    // main process as a global shortcut and forwarded here to toggle
    // Anchoran's own Launcher — see electron/main.ts and project
    // instructions §11/§16 for the security scope of this behavior.
    window.anchoran?.onToggleLauncher(() => setLauncherOpen((v) => !v));
  }, []);

  function shutDown() {
    // 1. Preferences and the virtual filesystem are already persisted
    //    continuously (see preferencesStore / fs.ts), so there is no
    //    separate "save" step needed here.
    // 2-4. Anchoran has no long-running internal app processes beyond
    //    its own React windows, which unmount as the app quits.
    window.anchoran?.confirmExit();
  }

  function restart() {
    window.anchoran?.restart();
  }

  function enterDesktop() {
    setSession("active");
    try {
      if (!localStorage.getItem(WELCOMED_KEY)) {
        localStorage.setItem(WELCOMED_KEY, "1");
        pushNotification("Welcome", "This is Anchoran OS. Press the Windows key or use the dock to open the Launcher.");
      }
    } catch {
      // best-effort only — a missing welcome toast isn't worth failing over
    }
  }

  if (session === "booting") {
    return (
      <ThemeProvider>
        <BootScreen onDone={enterDesktop} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div style={{ position: "relative", height: "100%", width: "100%" }}>
        <Desktop
          onLock={() => setSession("locked")}
          onSleep={() => setSession("locked")}
          onShutDown={shutDown}
          onRestart={restart}
          launcherOpen={launcherOpen}
          setLauncherOpen={setLauncherOpen}
        />
        {session === "locked" && <LockScreen onUnlock={() => setSession("active")} />}
        {exitDialogOpen && (
          <ExitConfirmDialog onCancel={() => setExitDialogOpen(false)} onExit={shutDown} />
        )}
      </div>
    </ThemeProvider>
  );
}
