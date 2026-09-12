import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { useWindowStore } from "@/windowmanager/windowStore";
import { APP_REGISTRY } from "@/applications/registry";
import { useDesktopIconsStore, type IconKey } from "./desktopIconsStore";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { AdminPinPrompt } from "@/core/AdminPinPrompt";

const GRID_X = 100;
const GRID_Y = 92;
const ORIGIN_X = 20;
const ORIGIN_Y = 20;

function slotFor(index: number) {
  const columnsPerScreen = 8;
  const col = Math.floor(index / columnsPerScreen);
  const row = index % columnsPerScreen;
  return { x: ORIGIN_X + col * GRID_X, y: ORIGIN_Y + row * GRID_Y };
}

interface IconEntry {
  key: IconKey;
  icon: IconName;
  label: string;
  onOpen: () => void;
  menu: ContextMenuItem[];
}

/**
 * Anchoran's desktop icons are pinned app shortcuts only — deliberately
 * NOT a live view of the real Windows Desktop folder's files (that was
 * tried and reverted; the user wants Anchoran's own desktop to stay a
 * stable, Anchoran-controlled surface rather than changing to mirror
 * whatever's really on disk).
 */
export function DesktopIcons() {
  const openApp = useWindowStore((s) => s.openApp);
  const pinnedApps = useDesktopIconsStore((s) => s.pinnedApps);
  const unpinApp = useDesktopIconsStore((s) => s.unpinApp);
  const positions = useDesktopIconsStore((s) => s.positions);
  const setPosition = useDesktopIconsStore((s) => s.setPosition);
  const [dragging, setDragging] = useState<IconKey | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [adminPinPrompt, setAdminPinPrompt] = useState(false);

  const entries: IconEntry[] = pinnedApps
    .filter((id) => APP_REGISTRY[id])
    .map((id): IconEntry => ({
      key: `app:${id}` as IconKey,
      icon: APP_REGISTRY[id].icon as IconName,
      label: APP_REGISTRY[id].title,
      onOpen: () => openApp(id),
      menu: [
        { label: "Open", onSelect: () => openApp(id) },
        ...(id === "terminal"
          ? [{ label: "Run as Administrator", icon: "lock" as IconName, onSelect: () => setAdminPinPrompt(true) }]
          : []),
        { label: "Remove from desktop", onSelect: () => unpinApp(id) },
      ],
    }));

  function onPointerDown(e: React.PointerEvent, key: IconKey) {
    if (e.button !== 0) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const index = entries.findIndex((en) => en.key === key);
    const base = positions[key] ?? slotFor(index);
    setDragging(key);
    let moved = false;

    function onMove(ev: PointerEvent) {
      moved = true;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setPosition(key, Math.max(0, base.x + dx), Math.max(0, base.y + dy));
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragging(null);
      if (!moved) {
        const entry = entries.find((en) => en.key === key);
        entry?.onOpen();
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="desktop-icons">
      {entries.map((entry, i) => {
        const pos = positions[entry.key] ?? slotFor(i);
        return (
          <div
            key={entry.key}
            className="desktop-icon"
            data-dragging={dragging === entry.key}
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={(e) => onPointerDown(e, entry.key)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({ x: e.clientX, y: e.clientY, items: entry.menu });
            }}
          >
            <Icon name={entry.icon} size={30} />
            <span>{entry.label}</span>
          </div>
        );
      })}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      {adminPinPrompt && (
        <AdminPinPrompt
          onCancel={() => setAdminPinPrompt(false)}
          onSuccess={() => {
            setAdminPinPrompt(false);
            openApp("terminal", { startAdmin: true });
          }}
        />
      )}
    </div>
  );
}
