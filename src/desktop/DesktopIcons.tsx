import { Icon, type IconName } from "@/components/Icon";
import { useWindowStore } from "@/windowmanager/windowStore";

const DESKTOP_SHORTCUTS = ["files", "terminal", "settings"] as const;
const LABELS: Record<(typeof DESKTOP_SHORTCUTS)[number], { icon: IconName; label: string }> = {
  files: { icon: "files", label: "Files" },
  terminal: { icon: "terminal", label: "Terminal" },
  settings: { icon: "settings", label: "Settings" },
};

export function DesktopIcons() {
  const openApp = useWindowStore((s) => s.openApp);

  return (
    <div className="desktop-icons">
      {DESKTOP_SHORTCUTS.map((id) => (
        <button
          key={id}
          className="desktop-icon"
          onDoubleClick={() => openApp(id)}
          style={{ border: "none", background: "transparent" }}
        >
          <Icon name={LABELS[id].icon} size={30} />
          <span>{LABELS[id].label}</span>
        </button>
      ))}
    </div>
  );
}
