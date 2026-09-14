import { lazy, Suspense } from "react";
import { useWindowStore } from "./windowStore";
import { WindowFrame } from "./WindowFrame";
import type { AppId } from "@/core/types";

// Each app is its own lazy chunk: Anchoran's initial load only ships
// the desktop shell, not every application's code — an app's bundle
// is fetched the first time a window for it actually opens. Exported
// so App.tsx can preload a few of these chunks in the background for
// whichever apps are actually used most (see preloadFrequentApps.ts)
// — the first real open of one of those then never has to wait on the
// fetch, without shipping every app's code up front.
export const APP_COMPONENTS: Record<
  AppId,
  React.LazyExoticComponent<
    (props: { openPath?: string; startAdmin?: boolean; windowId?: string; embedPath?: string; pluginId?: string }) => JSX.Element
  >
> = {
  files: lazy(() => import("@/applications/files/Files").then((m) => ({ default: m.FilesApp }))),
  terminal: lazy(() => import("@/applications/terminal/Terminal").then((m) => ({ default: m.TerminalApp }))),
  settings: lazy(() => import("@/applications/settings/Settings").then((m) => ({ default: m.SettingsApp }))),
  notes: lazy(() => import("@/applications/notes/Notes").then((m) => ({ default: m.NotesApp }))),
  browser: lazy(() => import("@/applications/browser/Browser").then((m) => ({ default: m.BrowserApp }))),
  systemMonitor: lazy(() =>
    import("@/applications/systemmonitor/SystemMonitor").then((m) => ({ default: m.SystemMonitorApp }))
  ),
  appCenter: lazy(() => import("@/applications/appcenter/AppCenter").then((m) => ({ default: m.AppCenterApp }))),
  photoViewer: lazy(() =>
    import("@/applications/photoviewer/PhotoViewer").then((m) => ({ default: m.PhotoViewerApp }))
  ),
  networkMonitor: lazy(() =>
    import("@/applications/networkmonitor/NetworkMonitor").then((m) => ({ default: m.NetworkMonitorApp }))
  ),
  eventViewer: lazy(() =>
    import("@/applications/eventviewer/EventViewer").then((m) => ({ default: m.EventViewerApp }))
  ),
  mediaPlayer: lazy(() =>
    import("@/applications/mediaplayer/MediaPlayer").then((m) => ({ default: m.MediaPlayerApp }))
  ),
  storageUsage: lazy(() =>
    import("@/applications/storageusage/StorageUsage").then((m) => ({ default: m.StorageUsageApp }))
  ),
  startupApps: lazy(() =>
    import("@/applications/startupapps/StartupApps").then((m) => ({ default: m.StartupAppsApp }))
  ),
  codeRunner: lazy(() =>
    import("@/applications/coderunner/CodeRunner").then((m) => ({ default: m.CodeRunnerApp }))
  ),
  // Recycle Bin, On-Screen Keyboard and Narrator never open a window —
  // see windowStore.ts's openApp — these entries only exist to satisfy
  // APP_COMPONENTS' type and are never rendered.
  recycleBin: lazy(() => Promise.resolve({ default: () => <></> })),
  onScreenKeyboard: lazy(() => Promise.resolve({ default: () => <></> })),
  narrator: lazy(() => Promise.resolve({ default: () => <></> })),
  embeddedApp: lazy(() =>
    import("@/applications/embeddedapp/EmbeddedApp").then((m) => ({ default: m.EmbeddedApp }))
  ),
  anchover: lazy(() => import("@/applications/anchover/Anchover").then((m) => ({ default: m.AnchoverApp }))),
  releaseRanking: lazy(() =>
    import("@/applications/releaseranking/ReleaseRanking").then((m) => ({ default: m.ReleaseRankingApp }))
  ),
  pluginHost: lazy(() => import("@/applications/pluginhost/PluginHost").then((m) => ({ default: m.PluginHostApp }))),
};

function AppLoadingFallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <div style={{ width: 22, height: 22, border: "2px solid var(--anchoran-border)", borderTopColor: "var(--anchoran-accent)", borderRadius: "50%", animation: "spin 700ms linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function WindowManager() {
  const windows = useWindowStore((s) => s.windows);
  const activeDesktopId = useWindowStore((s) => s.activeDesktopId);
  const snapPreview = useWindowStore((s) => s.snapPreview);
  // Only the active virtual desktop's windows are actually shown —
  // same principle as a minimized window not being rendered either.
  const visibleWindows = windows.filter((w) => w.desktopId === activeDesktopId);

  return (
    <div className="wm-layer">
      {visibleWindows.map((win) => {
        const AppComponent = APP_COMPONENTS[win.appId];
        return (
          <WindowFrame key={win.windowId} win={win}>
            <Suspense fallback={<AppLoadingFallback />}>
              <AppComponent
                openPath={win.openPath}
                startAdmin={win.startAdmin}
                windowId={win.windowId}
                embedPath={win.embedPath}
                pluginId={win.pluginId}
              />
            </Suspense>
          </WindowFrame>
        );
      })}
      {snapPreview && (
        <div
          className="wm-snap-preview"
          style={{
            left: snapPreview.x,
            top: snapPreview.y,
            width: snapPreview.width,
            height: snapPreview.height,
          }}
        />
      )}
    </div>
  );
}
