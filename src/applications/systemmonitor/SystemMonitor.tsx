import { useEffect, useState } from "react";
import { ANCHORAN_VERSION } from "@/core/version";
import "@/applications/apps.css";

interface MemoryInfo {
  usedMB: number;
  limitMB: number;
}

function readMemory(): MemoryInfo | null {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  };
  if (!perf.memory) return null;
  return {
    usedMB: Math.round(perf.memory.usedJSHeapSize / 1048576),
    limitMB: Math.round(perf.memory.jsHeapSizeLimit / 1048576),
  };
}

export function SystemMonitorApp() {
  const [memory, setMemory] = useState<MemoryInfo | null>(readMemory());
  const [uptime, setUptime] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setMemory(readMemory());
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const minutes = Math.floor(uptime / 60);
  const seconds = uptime % 60;

  return (
    <div className="app-root">
      <div className="app-content">
        <div className="sysmon-grid">
          <div className="sysmon-card">
            <div className="sysmon-card-label">Anchoran Version</div>
            <div className="sysmon-card-value">{ANCHORAN_VERSION}</div>
          </div>
          <div className="sysmon-card">
            <div className="sysmon-card-label">Platform</div>
            <div className="sysmon-card-value">{navigator.platform || "Unknown"}</div>
          </div>
          <div className="sysmon-card">
            <div className="sysmon-card-label">Session Uptime</div>
            <div className="sysmon-card-value">
              {minutes}m {seconds}s
            </div>
          </div>
          <div className="sysmon-card">
            <div className="sysmon-card-label">Network</div>
            <div className="sysmon-card-value">{online ? "Online" : "Offline"}</div>
          </div>
          <div className="sysmon-card">
            <div className="sysmon-card-label">Screen Resolution</div>
            <div className="sysmon-card-value">
              {window.screen.width} × {window.screen.height}
            </div>
          </div>
          {memory && (
            <div className="sysmon-card">
              <div className="sysmon-card-label">Renderer Memory</div>
              <div className="sysmon-card-value">
                {memory.usedMB} / {memory.limitMB} MB
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
