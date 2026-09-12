import type { CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";
import { iconColor } from "./iconColors";

/**
 * Renders an Icon glyph in white on top of its own solid color tile —
 * see iconColors.ts for why. Used everywhere an app or a file/folder
 * is represented as a single icon: the taskbar, desktop icons, the
 * Launcher, the Webstore, window title bars, and Files' file rows.
 */
export function IconTile({
  name,
  size = 32,
  shape = "square",
  glyphScale = 0.58,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  shape?: "square" | "circle";
  /** Fraction of `size` the glyph itself takes up. */
  glyphScale?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: shape === "circle" ? "50%" : Math.max(4, Math.round(size * 0.26)),
        background: iconColor(name),
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <Icon name={name} size={Math.round(size * glyphScale)} strokeWidth={1.7} />
    </span>
  );
}
