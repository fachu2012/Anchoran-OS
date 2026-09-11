import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { useWindowStore } from "@/windowmanager/windowStore";
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

interface DesktopFile {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface IconEntry {
  key: IconKey;
  icon: IconName;
  label: string;
  onOpen: () => void;
  menu: ContextMenuItem[];
}

/** The real Windows Desktop folder — these icons are actual files, not a virtual stand-in. */
export function DesktopIcons() {
  const openApp = useWindowStore((s) => s.openApp);
  const pinnedApps = useDesktopIconsStore((s) => s.pinnedApps);
  const unpinApp = useDesktopIconsStore((s) => s.unpinApp);
  const positions = useDesktopIconsStore((s) => s.positions);
  const setPosition = useDesktopIconsStore((s) => s.setPosition);
  const [desktopFiles, setDesktopFiles] = useState<DesktopFile[]>([]);
  const [dragging, setDragging] = useState<IconKey | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [renaming, setRenaming] = useState<{ key: IconKey; value: string } | null>(null);

  async function refresh() {
    if (!window.anchoran) return;
    const folders = await window.anchoran.fsSpecialFolders();
    const result = await window.anchoran.fsListDir(folders.desktop);
    if (!("error" in result)) {
      setDesktopFiles(result.entries.map((e) => ({ name: e.name, path: e.path, isDirectory: e.isDirectory })));
    }
  }

  useEffect(() => {
    refresh();
    // Light polling so files created elsewhere (the desktop's own
    // right-click "New Folder", something saved there by another app,
    // a real drag-and-drop from Explorer) show up without needing a
    // cross-component event bus for something this cheap to just poll.
    const interval = window.setInterval(refresh, 2500);
    return () => window.clearInterval(interval);
  }, []);

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
    ...desktopFiles.map((file): IconEntry => ({
      key: `file:${file.path}` as IconKey,
      icon: file.isDirectory ? "folder" : "file",
      label: file.name,
      onOpen: () => (file.isDirectory ? openApp("files") : window.anchoran!.fsOpenPath(file.path)),
      menu: [
        { label: "Rename", onSelect: () => setRenaming({ key: `file:${file.path}` as IconKey, value: file.name }) },
        {
          label: "Delete",
          onSelect: async () => {
            await window.anchoran!.fsDelete([file.path]);
            refresh();
          },
        },
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

  async function commitRename(key: IconKey, value: string) {
    const file = desktopFiles.find((f) => `file:${f.path}` === key);
    if (value.trim() && file) {
      await window.anchoran!.fsRename(file.path, value.trim());
      refresh();
    }
    setRenaming(null);
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
            {renaming?.key === entry.key ? (
              <input
                autoFocus
                value={renaming.value}
                onChange={(e) => setRenaming({ key: entry.key, value: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={() => commitRename(entry.key, renaming.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                style={{ width: "100%", fontSize: 12, textAlign: "center" }}
              />
            ) : (
              <span>{entry.label}</span>
            )}
          </div>
        );
      })}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}
