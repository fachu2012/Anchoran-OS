import { useEffect, useRef, useState } from "react";
import type { AnchoranPluginModule, AnchoranSDK } from "@/core/anchoranSDK";
import { useWindowStore } from "@/windowmanager/windowStore";
import { fetchPluginCatalog } from "@/applications/appcenter/pluginCatalog";
import { isAutoUpdateEnabled } from "@/core/pluginAutoUpdate";
import "@/applications/apps.css";

/** Matches "pluginHost"'s own minSize in apps.json — kept as a literal here rather than imported, since apps.json's per-app minSize isn't otherwise exposed as a lookup outside the window store's own internal bookkeeping. Also caps how large a plugin can request, so a bug or a bad actor's plugin can't force an absurd window size. */
const PLUGIN_HOST_MIN_SIZE = { width: 360, height: 260 };
const PLUGIN_PREFERRED_SIZE_MAX = { width: 2400, height: 1600 };

function clampPreferredSize(size: { width: number; height: number }) {
  return {
    width: Math.min(Math.max(size.width, PLUGIN_HOST_MIN_SIZE.width), PLUGIN_PREFERRED_SIZE_MAX.width),
    height: Math.min(Math.max(size.height, PLUGIN_HOST_MIN_SIZE.height), PLUGIN_PREFERRED_SIZE_MAX.height),
  };
}

/**
 * The generic window every downloaded third-party plugin opens into —
 * see the Anchoran Webstore's Community section, src/core/anchoranSDK.ts,
 * and README.md's "Anchoran App SDK" section for the whole design.
 * Anchoran itself never bundles a plugin's own code: this component
 * only knows how to find the file that `anchoran:plugin-install`
 * downloaded onto disk (if it's there at all — this window can be
 * reopened by a saved layout even after an uninstall) and call its
 * exported `mount()`, handing it a real DOM node and the shared SDK.
 */
export function PluginHostApp({
  windowId,
  pluginId,
  openPath,
}: {
  windowId?: string;
  pluginId?: string;
  /** Forwarded straight into the plugin's mount() as ctx.openPath — see anchoranSDK.ts. */
  openPath?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Set to the plugin's title while its "Auto-update" toggle (see
  // AppCenter.tsx's per-plugin checkbox, pluginAutoUpdate.ts) is
  // installing a newer version before this window opens it — every
  // open of a plugin funnels through this one component regardless of
  // where it was opened from (Launcher, Webstore, My Creations,
  // taskbar), so this is the one place that needs to know about it.
  const [updatingTitle, setUpdatingTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!pluginId || !windowId) {
      setError("This window wasn't opened with a specific plugin — nothing to show.");
      return;
    }
    if (!window.anchoran) {
      setError("Plugins aren't available outside the Anchoran desktop app.");
      return;
    }
    let cancelled = false;
    let unmount: (() => void) | null = null;
    let didUpdate = false;

    (async () => {
      const isInstalled = await window.anchoran!.pluginIsInstalled(pluginId);
      if (cancelled) return;
      if (!isInstalled) {
        setError("This plugin isn't installed anymore — reinstall it from the Webstore.");
        return;
      }

      if (isAutoUpdateEnabled(pluginId)) {
        try {
          const [installedList, { plugins: catalog }] = await Promise.all([window.anchoran!.pluginListInstalled(), fetchPluginCatalog()]);
          if (cancelled) return;
          const installedVersion = installedList.find((p) => p.id === pluginId)?.version;
          const catalogEntry = catalog.find((p) => p.id === pluginId);
          if (catalogEntry && installedVersion !== catalogEntry.version) {
            setUpdatingTitle(catalogEntry.title);
            const result = await window.anchoran!.pluginInstall(pluginId, catalogEntry.entry, {
              title: catalogEntry.title,
              icon: catalogEntry.icon,
              version: catalogEntry.version,
            });
            if (cancelled) return;
            // A failed update check/download never blocks opening the
            // still-working, already-installed version — same
            // "degrade gracefully offline" spirit as everything else
            // here that touches the network.
            didUpdate = result.success;
            setUpdatingTitle(null);
          }
        } catch {
          if (!cancelled) setUpdatingTitle(null);
        }
      }

      try {
        // Served by the anchoran-plugin:// protocol handler registered
        // in electron/main.ts, scoped to exactly this plugin's own
        // downloaded folder — not a raw file:// import, since Chromium
        // treats every file:// path as its own opaque origin and can
        // block a cross-path ES module fetch under webSecurity; a
        // registered, corsEnabled scheme behaves like a real origin
        // instead, no build-time bundling involved either way.
        // Cache-busted only when this open just installed a fresh
        // version — otherwise Chromium's module cache could keep
        // serving whatever this same plugin id resolved to earlier in
        // this session, from before the update.
        const importUrl = `anchoran-plugin://${pluginId}/index.js${didUpdate ? `?t=${Date.now()}` : ""}`;
        const mod = (await import(/* @vite-ignore */ importUrl)) as AnchoranPluginModule;
        if (cancelled || !containerRef.current) return;
        if (typeof mod.mount !== "function") {
          setError("This plugin's entry file doesn't export a mount() function — it may be corrupted.");
          return;
        }
        if (mod.preferredSize && Number.isFinite(mod.preferredSize.width) && Number.isFinite(mod.preferredSize.height)) {
          const { width, height } = clampPreferredSize(mod.preferredSize);
          useWindowStore.getState().resizeWindow(windowId, width, height);
        }
        const sdk = (window as unknown as { AnchoranSDK: AnchoranSDK }).AnchoranSDK;
        unmount = mod.mount(containerRef.current, sdk, { windowId, openPath });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [pluginId, windowId, openPath]);

  if (error) {
    return (
      <div className="app-root" style={{ alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ color: "#E5484D", fontSize: 13 }}>{error}</div>
      </div>
    );
  }

  if (updatingTitle) {
    return (
      <div className="app-root" style={{ alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", gap: 10 }}>
        <div style={{ fontSize: 13 }}>Updating {updatingTitle}…</div>
      </div>
    );
  }

  return <div ref={containerRef} className="app-root" style={{ overflow: "auto" }} />;
}
