import type { CSSProperties } from "react";

const LOGO_MASK = new URL("../../assets/logo/anchoran-logo-mask.png", import.meta.url).href;

/**
 * Anchoran's logo, rendered as a solid-color shape via a CSS mask
 * rather than an <img>. The source asset (assets/logo/anchoran-logo-mask.png)
 * is a plain white silhouette on a transparent background — using it as
 * a mask instead of drawing it directly means the logo always matches
 * whatever `color` is passed in (typically the user's chosen accent
 * color), everywhere it appears, without needing a separately-colored
 * image for every context or a re-export if the accent changes.
 */
export function AnchoranLogo({
  size = 64,
  color = "currentColor",
  style,
  className,
}: {
  size?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label="Anchoran"
      className={className}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: `url(${LOGO_MASK})`,
        maskImage: `url(${LOGO_MASK})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
