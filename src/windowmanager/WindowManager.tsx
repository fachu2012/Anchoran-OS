import { lazy, Suspense } from "react";
import { useWindowStore } from "./windowStore";
import { WindowFrame } from "./WindowFrame";
import type { AppId } from "@/core/types";

// Each app is its own lazy chunk: Anchoran's initial load only ships
// the desktop shell, not every application's code — an app's bundle
// is fetched the first time a window for it actually opens.
const APP_COMPONENTS: Record<AppId, React.LazyExoticComponent<() => JSX.Element>> = {
  files: lazy(() => import("@/applications/files/Files").then((m) => ({ default: m.FilesApp }))),
  terminal: lazy(() => import("@/applications/terminal/Terminal").then((m) => ({ default: m.TerminalApp }))),
  settings: lazy(() => import("@/applications/settings/Settings").then((m) => ({ default: m.SettingsApp }))),
  notes: lazy(() => import("@/applications/notes/Notes").then((m) => ({ default: m.NotesApp }))),
  calculator: lazy(() => import("@/applications/calculator/Calculator").then((m) => ({ default: m.CalculatorApp }))),
  browser: lazy(() => import("@/applications/browser/Browser").then((m) => ({ default: m.BrowserApp }))),
  systemMonitor: lazy(() =>
    import("@/applications/systemmonitor/SystemMonitor").then((m) => ({ default: m.SystemMonitorApp }))
  ),
  appCenter: lazy(() => import("@/applications/appcenter/AppCenter").then((m) => ({ default: m.AppCenterApp }))),
  clock: lazy(() => import("@/applications/clock/Clock").then((m) => ({ default: m.ClockApp }))),
  converter: lazy(() => import("@/applications/converter/Converter").then((m) => ({ default: m.ConverterApp }))),
  colorPicker: lazy(() =>
    import("@/applications/colorpicker/ColorPicker").then((m) => ({ default: m.ColorPickerApp }))
  ),
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
  const snapPreview = useWindowStore((s) => s.snapPreview);

  return (
    <div className="wm-layer">
      {windows.map((win) => {
        const AppComponent = APP_COMPONENTS[win.appId];
        return (
          <WindowFrame key={win.windowId} win={win}>
            <Suspense fallback={<AppLoadingFallback />}>
              <AppComponent />
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
