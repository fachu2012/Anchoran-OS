import { useState } from "react";
import { Icon } from "@/components/Icon";
import { APP_LIST } from "@/applications/registry";
import { useWindowStore } from "@/windowmanager/windowStore";
import "@/applications/apps.css";

/**
 * All apps ship built into Anchoran; "install" here is a simulated
 * state toggle (per the spec: "Inicialmente la instalación puede ser
 * simulada") rather than a real package manager.
 */
export function AppCenterApp() {
  const [installed, setInstalled] = useState<Set<string>>(
    new Set(APP_LIST.filter((a) => a.id !== "appCenter").map((a) => a.id))
  );
  const openApp = useWindowStore((s) => s.openApp);

  return (
    <div className="app-root">
      <div className="app-content">
        <div className="appcenter-grid">
          {APP_LIST.filter((a) => a.id !== "appCenter").map((app) => {
            const isInstalled = installed.has(app.id);
            return (
              <div className="appcenter-card" key={app.id}>
                <div className="appcenter-icon-badge">
                  <Icon name={app.icon as any} size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div>{app.title}</div>
                  <div className="appcenter-status">{isInstalled ? "Installed" : "Not installed"}</div>
                </div>
                <button
                  className="app-toolbar-btn"
                  onClick={() => {
                    if (isInstalled) {
                      openApp(app.id);
                    } else {
                      setInstalled((prev) => new Set(prev).add(app.id));
                    }
                  }}
                >
                  {isInstalled ? "Open" : "Install"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
