import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./startupapps.css";

interface StartupItem {
  name: string;
  command: string;
}

/**
 * Real Windows startup programs — reads/removes the per-user
 * HKCU\...\Run registry entries, the same list Task Manager's own
 * "Startup apps" tab shows. See electron/main.ts.
 */
export function StartupAppsApp() {
  const [items, setItems] = useState<StartupItem[] | null>(null);
  const pushNotification = useNotificationStore((s) => s.push);

  async function load() {
    if (!window.anchoran) return;
    setItems(await window.anchoran.listStartupItems());
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(name: string) {
    if (!window.anchoran) return;
    const result = await window.anchoran.removeStartupItem(name);
    if (!result.success) pushNotification("Startup Apps", result.error ?? "Couldn't remove this item.");
    load();
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={load}>
          <Icon name="restart" size={13} /> Refresh
        </button>
      </div>
      <div className="app-content startupapps-content">
        <p style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5, marginTop: 0 }}>
          Real Windows programs set to launch automatically when you sign in.
        </p>
        {items === null && (
          <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>
            Only available inside the Anchoran desktop app.
          </div>
        )}
        {items?.length === 0 && (
          <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>Nothing set to start up.</div>
        )}
        {items?.map((item) => (
          <div key={item.name} className="startupapps-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="startupapps-name">{item.name}</div>
              <div className="startupapps-command">{item.command}</div>
            </div>
            <button className="app-toolbar-btn" onClick={() => remove(item.name)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
