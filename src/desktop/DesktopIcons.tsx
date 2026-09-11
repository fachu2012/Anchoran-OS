import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useFsStore, DESKTOP_ID, type FsNode } from "@/filesystem/fs";
import { APP_REGISTRY } from "@/applications/registry";
import { useDesktopIconsStore, type IconKey } from "./desktopIconsStore";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";

const GRID_X = 100;
const GRID_Y = 92;
const ORIGIN_X = 20;
const ORIGIN_Y = 20;

function slotFor(index: number, columnsPerScreen = 8) {
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

export function DesktopIcons() {
  const openApp = useWindowStore((s) => s.openApp);
  const pinnedApps = useDesktopIconsStore((s) => s.pinnedApps);
  const unpinApp = useDesktopIconsStore((s) => s.unpinApp);
  const positions = useDesktopIconsStore((s) => s.positions);
  const setPosition = useDesktopIconsStore((s) => s.setPosition);
  const desktopFiles = useFsStore((s) => s.childrenOf(DESKTOP_ID));
  const removeMany = useFsStore((s) => s.removeMany);
  const rename = useFsStore((s) => s.rename);
  const [dragging, setDragging] = useState<IconKey | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [renaming, setRenaming] = useState<{ key: IconKey; value: string } | null>(null);

  const entries: IconEntry[] = [
    ...pinnedApps
      .filter((id) => APP_REGISTRY[id])
      .map((id): IconEntry => ({
        key: `app:${id}` as IconKey,
        icon: APP_REGISTRY[id].icon as IconName,
        label: APP_REGISTRY[id].title,
        onOpen: () => openApp(id),
        menu: [
          { label: "Open", onSelect: () => openApp(id) },
          { label: "Remove from desktop", onSelect: () => unpinApp(id) },
        ],
      })),
    ...desktopFiles.map((node): IconEntry => ({
      key: `file:${node.id}` as IconKey,
      icon: node.type === "folder" ? "folder" : "file",
      label: node.name,
      onOpen: () => openApp("files"),
      menu: [
        { label: "Rename", onSelect: () => setRenaming({ key: `file:${node.id}` as IconKey, value: node.name }) },
        { label: "Delete", onSelect: () => removeMany([node.id]) },
      ],
    })),
  ];

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
        const node: FsNode | undefined = entry.key.startsWith("file:")
          ? desktopFiles.find((n) => `file:${n.id}` === entry.key)
          : undefined;
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
            {renaming?.key === entry.key ? (
              <input
                autoFocus
                value={renaming.value}
                onChange={(e) => setRenaming({ key: entry.key, value: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={() => {
                  if (renaming.value.trim() && node) rename(node.id, renaming.value.trim());
                  setRenaming(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                style={{ width: "100%", fontSize: 12, textAlign: "center" }}
              />
            ) : (
              <span>{entry.label}</span>
            )}
          </div>
        );
      })}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
