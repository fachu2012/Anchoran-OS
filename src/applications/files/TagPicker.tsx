import { useEffect, useRef } from "react";
import { TAG_COLORS, TAG_COLOR_HEX, type TagColor } from "./fileTagsStore";
import { Icon } from "@/components/Icon";

/**
 * A tiny floating swatch row for assigning a color tag to a file —
 * ContextMenu has no submenu support (see its own notes), so this is
 * a second, purpose-built popover instead of trying to cram six
 * "Tag: Color" entries into the flat context menu.
 */
export function TagPicker({
  x,
  y,
  current,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  current: TagColor | null;
  onPick: (color: TagColor | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [onClose]);

  return (
    <div ref={ref} className="tag-picker" style={{ left: x, top: y }}>
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          className="tag-picker-swatch"
          data-active={current === color}
          style={{ background: TAG_COLOR_HEX[color] }}
          aria-label={color}
          title={color}
          onClick={() => {
            onPick(current === color ? null : color);
            onClose();
          }}
        />
      ))}
      <button
        className="tag-picker-clear"
        aria-label="No tag"
        title="No tag"
        onClick={() => {
          onPick(null);
          onClose();
        }}
      >
        <Icon name="close" size={11} />
      </button>
    </div>
  );
}
