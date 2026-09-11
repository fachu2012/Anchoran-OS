import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { APP_LIST } from "@/applications/registry";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useNotificationStore } from "@/notifications/notificationStore";
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
  const pushNotification = useNotificationStore((s) => s.push);

  return (
    <div className="app-root">
      <div className="app-content">
        <div className="appcenter-grid">
          {APP_LIST.filter((a) => a.id !== "appCenter").map((app) => {
            const isInstalled = installed.has(app.id);
            return (
              <div className="appcenter-card" key={app.id}>
                <div className="appcenter-icon-badge">
                  <Icon name={app.icon as IconName} size={20} />
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
                      pushNotification("App Center", `${app.title} was installed.`);
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
