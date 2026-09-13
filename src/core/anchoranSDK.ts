import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Icon } from "@/components/Icon";
import { IconTile } from "@/components/IconTile";
import { useNotificationStore } from "@/notifications/notificationStore";
import { usePreferencesStore } from "@/theme/preferencesStore";

/**
 * Anchoran's public plugin API — the one surface a third-party app is
 * meant to talk to, instead of importing Anchoran's own internal
 * `@/...` modules directly (those change freely between versions with
 * no compatibility promise at all). This object's *shape* is what's
 * versioned and stable: a plugin built against SDK 1.0 keeps working
 * on every later Anchoran release, without Anchoran itself needing a
 * new version just to add or update a plugin app — see the "Anchoran
 * App SDK" section of README.md for the whole design.
 *
 * Deliberately small for this first version: enough for a real plugin
 * to render UI (via the host's own React/ReactDOM — a plugin doesn't
 * ship its own copy, keeping downloads tiny and avoiding two React
 * instances arguing over one page) and to reach a couple of everyday
 * host actions. It only ever grows from here, never changes shape in
 * a breaking way — see ANCHORAN_SDK_VERSION.
 */
export const ANCHORAN_SDK_VERSION = "1.0.0";

export interface AnchoranSDK {
  /** The SDK's own version — not Anchoran OS's version. Compare against this, not window.anchoran's version APIs, to know what a plugin can rely on being present. */
  version: string;
  React: typeof React;
  ReactDOM: typeof ReactDOM;
  Icon: typeof Icon;
  IconTile: typeof IconTile;
  pushNotification: (title: string, message: string) => void;
  getAccentColor: () => string;
  getThemeMode: () => "light" | "dark";
}

/**
 * The contract a plugin's own built entry file must export. Anchoran
 * calls `mount` once, handing it a real DOM node to render into (sized
 * to the plugin's own window) and this same SDK object; the plugin
 * returns its own cleanup function, called when that window closes.
 * No JSX/React composition crosses the boundary — a plugin mounts its
 * own React root inside `container` using `sdk.ReactDOM`, exactly the
 * same "multiple roots on one page" pattern a host page uses to embed
 * an unrelated widget.
 */
export interface AnchoranPluginModule {
  mount: (container: HTMLElement, sdk: AnchoranSDK, ctx: { windowId: string }) => () => void;
}

let installed: AnchoranSDK | null = null;

/** Called once, early in App startup — see src/main.tsx. */
export function installAnchoranSDK(): void {
  if (installed) return;
  installed = {
    version: ANCHORAN_SDK_VERSION,
    React,
    ReactDOM,
    Icon,
    IconTile,
    pushNotification: (title, message) => useNotificationStore.getState().push(title, message),
    getAccentColor: () => usePreferencesStore.getState().accentColor,
    getThemeMode: () => usePreferencesStore.getState().themeMode,
  };
  (window as unknown as { AnchoranSDK: AnchoranSDK }).AnchoranSDK = installed;
}
