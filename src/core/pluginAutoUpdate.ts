/**
 * Per-plugin "Auto-update" preference — a plain localStorage-backed
 * map (every Anchoran window shares the same origin, same pattern as
 * AppCenter's own CODE_STUDIO_PROJECTS_KEY), read by PluginHost.tsx
 * every time a plugin window opens and set from AppCenter's own
 * per-plugin toggle. Off by default: an update always still shows up
 * as an "Update" button in the Webstore even with this off, this only
 * controls whether opening the app installs it automatically first.
 */
const KEY = "anchoran-plugin-autoupdate";

function readMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function isAutoUpdateEnabled(pluginId: string): boolean {
  return readMap()[pluginId] === true;
}

export function setAutoUpdateEnabled(pluginId: string, enabled: boolean): void {
  const map = readMap();
  if (enabled) map[pluginId] = true;
  else delete map[pluginId];
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* private/blocked storage — the toggle just won't persist across a restart, not worth surfacing an error for */
  }
}
