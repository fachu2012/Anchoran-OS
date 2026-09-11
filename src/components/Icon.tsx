import type { SVGProps } from "react";

/**
 * All Anchoran iconography is drawn here as inline stroke-based SVG
 * paths — a single consistent set (1.5px stroke, 24x24 grid), never
 * emoji, never raster. This keeps every icon on-brand and trivially
 * recolorable via currentColor / theme tokens.
 *
 * Icons whose final design is not yet defined are intentionally
 * simple/neutral placeholders and can be swapped here without
 * touching any call site.
 */
export type IconName =
  | "files"
  | "terminal"
  | "settings"
  | "notes"
  | "calculator"
  | "browser"
  | "systemMonitor"
  | "appCenter"
  | "launcher"
  | "power"
  | "lock"
  | "wifi"
  | "volume"
  | "battery"
  | "notification"
  | "search"
  | "close"
  | "minimize"
  | "maximize"
  | "restore"
  | "chevronRight"
  | "folder"
  | "file"
  | "check";

const PATHS: Record<IconName, string> = {
  files:
    "M3 6.5A1.5 1.5 0 0 1 4.5 5h4l1.6 2H19.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11Z",
  terminal: "M4 5.5h16v13H4v-13Zm3 4 3 2.5-3 2.5M12.5 14.5h4",
  settings:
    "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-3.2a7.4 7.4 0 0 0-.13-1.38l1.86-1.45-1.86-3.22-2.2.62a7.5 7.5 0 0 0-2.39-1.38L14.3 3h-4.6l-.38 2.19a7.5 7.5 0 0 0-2.39 1.38l-2.2-.62-1.86 3.22 1.86 1.45c-.09.45-.13.9-.13 1.38s.04.93.13 1.38l-1.86 1.45 1.86 3.22 2.2-.62c.71.6 1.52 1.07 2.39 1.38L9.7 21h4.6l.38-2.19c.87-.31 1.68-.78 2.39-1.38l2.2.62 1.86-3.22-1.86-1.45c.09-.45.13-.9.13-1.38Z",
  notes: "M6 4.5h9l3 3v12H6v-15Zm9 0v3h3M8.5 12h7M8.5 15.5h7",
  calculator:
    "M6 3.5h12v17H6v-17Zm1.5 3h9M8 10h1.6M11.2 10h1.6M14.4 10h1.6M8 13h1.6M11.2 13h1.6M14.4 13v4M8 16h1.6M11.2 16h1.6",
  browser:
    "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-8-8h16M12 4c2 2.2 3 5 3 8s-1 5.8-3 8c-2-2.2-3-5-3-8s1-5.8 3-8Z",
  systemMonitor:
    "M4 5.5h16v10H4v-10Zm5 13.5h6M12 15.5V19M7 12.5l2.4-3.2 2 2.4 3-4",
  appCenter: "M5 5h5.5v5.5H5V5Zm8.5 0H19v5.5h-5.5V5ZM5 13.5h5.5V19H5v-5.5Zm8.5 0H19V19h-5.5v-5.5Z",
  launcher: "M4 6.5h16M4 12h16M4 17.5h16",
  power: "M12 4v7.5M7 6.6a7 7 0 1 0 10 0",
  lock: "M7 10.5V8a5 5 0 0 1 10 0v2.5M5.5 10.5h13v9h-13v-9ZM12 14.5v2.2",
  wifi: "M3.5 9.5a12.5 12.5 0 0 1 17 0M6.3 12.9a8.5 8.5 0 0 1 11.4 0M9.2 16.2a4.3 4.3 0 0 1 5.6 0M12 19.2h.01",
  volume: "M4.5 9.5h3.2L12 6v12l-4.3-3.5H4.5v-5Zm11 -1.8a5.5 5.5 0 0 1 0 8.6M17.7 5.5a9.5 9.5 0 0 1 0 13",
  battery: "M3.5 9h14v6h-14V9Zm14 1.5h1.8a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1.8v-3ZM6 9v6",
  notification:
    "M12 4.5a5 5 0 0 0-5 5v3l-1.5 3h13L17 12.5v-3a5 5 0 0 0-5-5Zm-1.8 13a1.8 1.8 0 0 0 3.6 0",
  search: "M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm6.9 13.4L21 21",
  close: "M6 6l12 12M18 6 6 18",
  minimize: "M5 12.5h14",
  maximize: "M6.5 6.5h11v11h-11v-11Z",
  restore: "M8.5 4.5h11v11h-3M4.5 8.5h11v11h-11v-11Z",
  chevronRight: "M9.5 5.5 16 12l-6.5 6.5",
  folder: "M3.5 7A1.5 1.5 0 0 1 5 5.5h4l1.6 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7Z",
  file: "M7 3.5h7l4 4v13H7v-17Zm7 0v4h4",
  check: "M5 12.5l4.5 4.5L19 7.5",
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.6,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
