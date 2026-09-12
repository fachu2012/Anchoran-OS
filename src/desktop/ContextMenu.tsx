import { useEffect, useRef } from "react";
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
    <div ref={ref} className="context-menu" style={{ left: x, top: y }}>
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
