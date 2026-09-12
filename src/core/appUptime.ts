/** When this renderer process actually started — module-level, so it's set once, the first time any code imports this. */
export const APP_START_MS = Date.now();

export function getAppUptimeSeconds(): number {
  return Math.floor((Date.now() - APP_START_MS) / 1000);
}
