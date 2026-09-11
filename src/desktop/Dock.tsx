import { Icon, type IconName } from "@/components/Icon";
import { APP_LIST } from "@/applications/registry";
import { useWindowStore } from "@/windowmanager/windowStore";

const PINNED = ["files", "terminal", "browser", "notes", "settings"] as const;

export function Dock({ onLauncher }: { onLauncher: () => void }) {
  const openApp = useWindowStore((s) => s.openApp);
  const windows = useWindowStore((s) => s.windows);

  return (
    <nav className="dock">
      <button className="dock-btn" onClick={onLauncher} aria-label="Launcher">
        <Icon name="launcher" size={20} />
      </button>
      <div className="dock-divider" />
      {PINNED.map((id) => {
        const app = APP_LIST.find((a) => a.id === id)!;
        const hasWindow = windows.some((w) => w.appId === id);
        return (
          <button
            key={id}
            className="dock-btn"
            onClick={() => openApp(id)}
            aria-label={app.title}
            style={hasWindow ? { boxShadow: "inset 0 -2px 0 var(--anchoran-accent)" } : undefined}
          >
            <Icon name={app.icon as IconName} size={20} />
          </button>
        );
      })}
    </nav>
  );
}
