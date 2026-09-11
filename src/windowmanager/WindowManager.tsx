import { useWindowStore } from "./windowStore";
import { WindowFrame } from "./WindowFrame";
import { FilesApp } from "@/applications/files/Files";
import { TerminalApp } from "@/applications/terminal/Terminal";
import { SettingsApp } from "@/applications/settings/Settings";
import { NotesApp } from "@/applications/notes/Notes";
import { CalculatorApp } from "@/applications/calculator/Calculator";
import { BrowserApp } from "@/applications/browser/Browser";
import { SystemMonitorApp } from "@/applications/systemmonitor/SystemMonitor";
import { AppCenterApp } from "@/applications/appcenter/AppCenter";
import type { AppId } from "@/core/types";

const APP_COMPONENTS: Record<AppId, () => JSX.Element> = {
  files: FilesApp,
  terminal: TerminalApp,
  settings: SettingsApp,
  notes: NotesApp,
  calculator: CalculatorApp,
  browser: BrowserApp,
  systemMonitor: SystemMonitorApp,
  appCenter: AppCenterApp,
};

export function WindowManager() {
  const windows = useWindowStore((s) => s.windows);

  return (
    <div className="wm-layer">
      {windows.map((win) => {
        const AppComponent = APP_COMPONENTS[win.appId];
        return (
          <WindowFrame key={win.windowId} win={win}>
            <AppComponent />
          </WindowFrame>
        );
      })}
    </div>
  );
}
