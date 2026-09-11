import type { AppDefinition, AppId } from "@/core/types";

/**
 * Central registry of every application Anchoran ships with. The
 * Launcher, Dock, App Center and WindowManager all read from this
 * single list rather than hardcoding app metadata in multiple places.
 */
export const APP_REGISTRY: Record<AppId, AppDefinition> = {
  files: {
    id: "files",
    title: "Files",
    icon: "files",
    defaultSize: { width: 920, height: 600 },
    minSize: { width: 480, height: 320 },
  },
  terminal: {
    id: "terminal",
    title: "Terminal",
    icon: "terminal",
    allowMultipleInstances: true,
    defaultSize: { width: 760, height: 460 },
    minSize: { width: 420, height: 260 },
  },
  settings: {
    id: "settings",
    title: "Settings",
    icon: "settings",
    defaultSize: { width: 880, height: 600 },
    minSize: { width: 640, height: 440 },
  },
  notes: {
    id: "notes",
    title: "Notes",
    icon: "notes",
    allowMultipleInstances: true,
    defaultSize: { width: 640, height: 520 },
    minSize: { width: 360, height: 280 },
  },
  calculator: {
    id: "calculator",
    title: "Calculator",
    icon: "calculator",
    defaultSize: { width: 340, height: 480 },
    minSize: { width: 300, height: 420 },
  },
  browser: {
    id: "browser",
    title: "Browser",
    icon: "browser",
    defaultSize: { width: 1000, height: 660 },
    minSize: { width: 480, height: 360 },
  },
  systemMonitor: {
    id: "systemMonitor",
    title: "System Monitor",
    icon: "systemMonitor",
    defaultSize: { width: 720, height: 520 },
    minSize: { width: 480, height: 360 },
  },
  appCenter: {
    id: "appCenter",
    title: "App Center",
    icon: "appCenter",
    defaultSize: { width: 860, height: 560 },
    minSize: { width: 560, height: 400 },
  },
};

export const APP_LIST: AppDefinition[] = Object.values(APP_REGISTRY);
