import type { AppDefinition, AppId } from "@/core/types";

/**
 * Central registry of every application Anchoran ships with. The
 * Launcher, Dock, Anchoran Webstore and WindowManager all read from
 * this single list rather than hardcoding app metadata in multiple
 * places.
 */
export const APP_REGISTRY: Record<AppId, AppDefinition> = {
  files: {
    id: "files",
    title: "Files",
    icon: "files",
    category: "System",
    description: "Browse, organize and search Anchoran's own filesystem.",
    defaultSize: { width: 920, height: 600 },
    minSize: { width: 480, height: 320 },
  },
  terminal: {
    id: "terminal",
    title: "Terminal",
    icon: "terminal",
    category: "System",
    description: "A command-line shell for Anchoran's filesystem and system commands.",
    allowMultipleInstances: true,
    defaultSize: { width: 760, height: 460 },
    minSize: { width: 420, height: 260 },
  },
  settings: {
    id: "settings",
    title: "Settings",
    icon: "settings",
    category: "System",
    description: "Appearance, sound, notifications, users, privacy and system info.",
    defaultSize: { width: 880, height: 600 },
    minSize: { width: 640, height: 440 },
  },
  notes: {
    id: "notes",
    title: "Notes",
    icon: "notes",
    category: "Productivity",
    description: "A simple multi-document text editor.",
    allowMultipleInstances: true,
    defaultSize: { width: 640, height: 520 },
    minSize: { width: 360, height: 280 },
  },
  calculator: {
    id: "calculator",
    title: "Calculator",
    icon: "calculator",
    category: "Utilities",
    description: "A standard calculator.",
    defaultSize: { width: 340, height: 480 },
    minSize: { width: 300, height: 420 },
  },
  browser: {
    id: "browser",
    title: "Browser",
    icon: "browser",
    category: "Internet",
    description: "Browse the web from inside Anchoran.",
    defaultSize: { width: 1000, height: 660 },
    minSize: { width: 480, height: 360 },
  },
  systemMonitor: {
    id: "systemMonitor",
    title: "System Monitor",
    icon: "systemMonitor",
    category: "System",
    description: "Real CPU, memory and platform information.",
    defaultSize: { width: 720, height: 520 },
    minSize: { width: 480, height: 360 },
  },
  appCenter: {
    id: "appCenter",
    title: "Anchoran Webstore",
    icon: "appCenter",
    category: "System",
    description: "Browse and install Anchoran's built-in applications.",
    defaultSize: { width: 900, height: 600 },
    minSize: { width: 620, height: 420 },
  },
  clock: {
    id: "clock",
    title: "Clock",
    icon: "clock",
    category: "Utilities",
    description: "World clocks, a stopwatch and a countdown timer.",
    defaultSize: { width: 420, height: 520 },
    minSize: { width: 340, height: 420 },
  },
  converter: {
    id: "converter",
    title: "Converter",
    icon: "converter",
    category: "Utilities",
    description: "Convert length, weight, temperature and data size.",
    defaultSize: { width: 380, height: 460 },
    minSize: { width: 320, height: 400 },
  },
  colorPicker: {
    id: "colorPicker",
    title: "Color Picker",
    icon: "colorPicker",
    category: "Utilities",
    description: "Pick colors and copy HEX, RGB or HSL values.",
    defaultSize: { width: 420, height: 480 },
    minSize: { width: 360, height: 420 },
  },
};

export const APP_LIST: AppDefinition[] = Object.values(APP_REGISTRY);
