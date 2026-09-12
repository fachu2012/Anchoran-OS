import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Optional — most existing menus don't set one, and that's fine, the label just starts flush left instead. */
  icon?: IconName;
}

export interface ContextMenuSeparator {
  separator: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

function isSeparator(entry: ContextMenuEntry): entry is ContextMenuSeparator {
  return "separator" in entry;
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The menu is rendered once at the raw click point to measure its own
  // size, then nudged back on-screen if it would otherwise overflow any
  // edge — up if it runs off the bottom, left if it runs off the right,
  // and so on. Hidden until that correction is applied so it never
  // visibly flashes in the wrong spot first.
  const [pos, setPos] = useState<{ x: number; y: number; ready: boolean }>({ x, y, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 6;
    let nx = x;
    let ny = y;
    if (nx + rect.width > window.innerWidth - margin) nx = window.innerWidth - rect.width - margin;
    if (ny + rect.height > window.innerHeight - margin) ny = window.innerHeight - rect.height - margin;
    nx = Math.max(margin, nx);
    ny = Math.max(margin, ny);
    setPos({ x: nx, y: ny, ready: true });
  }, [x, y]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: pos.x, top: pos.y, visibility: pos.ready ? "visible" : "hidden" }}
    >
      {items.map((entry, i) =>
        isSeparator(entry) ? (
          <div key={`sep-${i}`} className="context-menu-separator" />
        ) : (
          <button
            key={entry.label}
            className="context-menu-item"
            data-danger={entry.danger || undefined}
            disabled={entry.disabled}
            onClick={() => {
              if (entry.disabled) return;
              entry.onSelect();
              onClose();
            }}
          >
            {entry.icon && (
              <span className="context-menu-item-icon">
                <Icon name={entry.icon} size={14} />
              </span>
            )}
            {entry.label}
          </button>
        )
      )}
    </div>
  );
}
