import { useEffect, useRef, useState } from "react";
import type { AnchoranPluginModule, AnchoranSDK } from "@/core/anchoranSDK";
import "@/applications/apps.css";

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
export function PluginHostApp({ windowId, pluginId }: { windowId?: string; pluginId?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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

    (async () => {
      const isInstalled = await window.anchoran!.pluginIsInstalled(pluginId);
      if (cancelled) return;
      if (!isInstalled) {
        setError("This plugin isn't installed anymore — reinstall it from the Webstore.");
        return;
      }
      try {
        // Served by the anchoran-plugin:// protocol handler registered
        // in electron/main.ts, scoped to exactly this plugin's own
        // downloaded folder — not a raw file:// import, since Chromium
        // treats every file:// path as its own opaque origin and can
        // block a cross-path ES module fetch under webSecurity; a
        // registered, corsEnabled scheme behaves like a real origin
        // instead, no build-time bundling involved either way.
        const mod = (await import(/* @vite-ignore */ `anchoran-plugin://${pluginId}/index.js`)) as AnchoranPluginModule;
        if (cancelled || !containerRef.current) return;
        if (typeof mod.mount !== "function") {
          setError("This plugin's entry file doesn't export a mount() function — it may be corrupted.");
          return;
        }
        const sdk = (window as unknown as { AnchoranSDK: AnchoranSDK }).AnchoranSDK;
        unmount = mod.mount(containerRef.current, sdk, { windowId });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [pluginId, windowId]);

  if (error) {
    return (
      <div className="app-root" style={{ alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ color: "#E5484D", fontSize: 13 }}>{error}</div>
      </div>
    );
  }

  return <div ref={containerRef} className="app-root" style={{ overflow: "auto" }} />;
}
