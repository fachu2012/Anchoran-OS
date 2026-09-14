import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Icon } from "@/components/Icon";
import { IconTile } from "@/components/IconTile";
import { useNotificationStore } from "@/notifications/notificationStore";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { useWindowStore } from "@/windowmanager/windowStore";
import type { AppId } from "@/core/types";

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
  /**
   * Opens any Anchoran window, including another `pluginHost` window —
   * how Anchoran Code Studio's "Open in Window" runs the project it's
   * editing in a real, separate Anchoran window instead of only its
   * own embedded preview, by reusing the exact same `pluginHost` +
   * `ctx.openPath` mechanism the Webstore's "My Creations" already
   * uses to open a specific local project. `appId` is intentionally a
   * plain string, not Anchoran's own internal AppId union — a plugin
   * has no business knowing that type exists, only that "pluginHost"
   * is the one that opens plugin code. Returns the new window's id.
   */
  openApp: (appId: string, options?: { pluginId?: string; title?: string; openPath?: string }) => string;
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
  /**
   * `ctx.openPath`, when set, is whatever the window that opened this
   * plugin was told to open — the same generic mechanism Files uses to
   * tell Notes/Photo Viewer/Code Runner which file to load. For a
   * plugin like Anchoran Code Studio, the Webstore's "My Creations"
   * section uses this to hand over a specific local project's id so
   * Code Studio opens straight into it instead of its own picker —
   * entirely optional, most plugins never look at it.
   */
  mount: (container: HTMLElement, sdk: AnchoranSDK, ctx: { windowId: string; openPath?: string }) => () => void;
  /**
   * Optional: the window size (in CSS pixels) this plugin actually
   * wants, applied once, the moment PluginHost finishes loading it —
   * without this, every downloaded plugin opens at the same generic
   * "pluginHost" default (640×480) no matter how cramped or oversized
   * that is for what it actually renders. A plain, static export (not
   * a function) so PluginHost can apply it before the user has a
   * chance to resize the window by hand; PluginHost clamps it to the
   * "pluginHost" app's own minSize (360×260) and a sane upper bound,
   * so a plugin can't request something unusably small or a window
   * bigger than the desktop can reasonably hold. A later manual resize
   * by the user always wins — this only sets the STARTING size.
   */
  preferredSize?: { width: number; height: number };
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
    openApp: (appId, options) => useWindowStore.getState().openApp(appId as AppId, options),
  };
  (window as unknown as { AnchoranSDK: AnchoranSDK }).AnchoranSDK = installed;
}
