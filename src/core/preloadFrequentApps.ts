import { APP_COMPONENTS } from "@/windowmanager/WindowManager";

type AnyLazyComponent = (typeof APP_COMPONENTS)[keyof typeof APP_COMPONENTS];
import { useAppUsageStore } from "@/core/appUsageStore";
import { useInstalledAppsStore } from "@/applications/installedAppsStore";

/**
 * Triggers a React.lazy component's underlying dynamic import() ahead
 * of time, without rendering (and so without mounting) it — the
 * component's real first open then resolves from the already-fetched
 * chunk instead of waiting on the network/disk again. This leans on
 * React 18's internal `_payload`/`_init` shape on a lazy component,
 * which isn't a published public API — kept defensive (try/catch,
 * silently does nothing if that shape ever changes in a future React
 * version) since the worst case is simply "no preload happened", never
 * a crash.
 */
function preloadLazy(component: AnyLazyComponent) {
  try {
    const payload = (component as unknown as { _payload?: { _status?: number; _result?: unknown; _init?: (p: unknown) => unknown } })._payload;
    if (payload && typeof payload._init === "function" && payload._status !== 1) {
      payload._init(payload);
    }
  } catch {
    // Best-effort only.
  }
}

/** Preloads the JS chunks for whichever apps are actually opened most — see appUsageStore.ts's own usage counts. Call once, a short while after boot, so it never competes with the boot sequence's own real work. */
export function preloadFrequentApps(count = 3) {
  const installed = useInstalledAppsStore.getState().installed;
  const topAppIds = useAppUsageStore.getState().topApps(count);
  for (const appId of topAppIds) {
    if (!installed.has(appId)) continue;
    const component = APP_COMPONENTS[appId];
    if (component) preloadLazy(component);
  }
}
