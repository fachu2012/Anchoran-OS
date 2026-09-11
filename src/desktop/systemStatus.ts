import { useEffect, useState } from "react";

export interface SystemStatus {
  online: boolean;
  batterySupported: boolean;
  batteryLevel: number; // 0..1
  charging: boolean;
}

/**
 * Real, but honestly limited, live status for the taskbar tray icons:
 * - Network: `navigator.onLine` (connectivity, not SSID/signal strength
 *   — reading the actual Wi-Fi adapter needs a native module Anchoran
 *   doesn't have yet).
 * - Battery: the Battery Status API, when the host exposes one (most
 *   laptops under Chromium/Electron do; desktops without a battery
 *   report a full, "charging" battery, which is treated as AC power).
 */
export function useSystemStatus(): SystemStatus {
  const [status, setStatus] = useState<SystemStatus>({
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    batterySupported: false,
    batteryLevel: 1,
    charging: true,
  });

  useEffect(() => {
    const onOnline = () => setStatus((s) => ({ ...s, online: true }));
    const onOffline = () => setStatus((s) => ({ ...s, online: false }));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    let battery: (EventTarget & { level: number; charging: boolean }) | null = null;
    const nav = navigator as Navigator & { getBattery?: () => Promise<any> };

    function syncBattery() {
      if (!battery) return;
      setStatus((s) => ({ ...s, batterySupported: true, batteryLevel: battery!.level, charging: battery!.charging }));
    }

    nav.getBattery?.().then((b) => {
      battery = b;
      syncBattery();
      b.addEventListener("levelchange", syncBattery);
      b.addEventListener("chargingchange", syncBattery);
    });

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (battery) {
        battery.removeEventListener("levelchange", syncBattery);
        battery.removeEventListener("chargingchange", syncBattery);
      }
    };
  }, []);

  return status;
}
