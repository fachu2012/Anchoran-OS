import { useEffect, useState } from "react";
import { ANCHORAN_VERSION } from "@/core/version";
import "@/applications/apps.css";

interface SystemInfo {
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  cpuUsagePercent: number;
  totalMemMB: number;
  freeMemMB: number;
  systemUptimeSec: number;
}

function formatUptime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function SystemMonitorApp() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [renderMemMB, setRenderMemMB] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (window.anchoran) {
        const data = await window.anchoran.getSystemInfo();
        if (!cancelled) setInfo(data);
      }
      const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
      if (perf.memory) setRenderMemMB(Math.round(perf.memory.usedJSHeapSize / 1048576));
    }

    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const usedMemMB = info ? info.totalMemMB - info.freeMemMB : null;
  const memPercent = info ? Math.round((usedMemMB! / info.totalMemMB) * 100) : null;

  return (
    <div className="app-root">
      <div className="app-content">
        {!info ? (
          <p style={{ color: "var(--anchoran-text-secondary)", fontSize: 13 }}>
            System information is only available inside the Anchoran desktop app.
          </p>
        ) : (
          <div className="sysmon-grid">
            <div className="sysmon-card">
              <div className="sysmon-card-label">Anchoran Version</div>
              <div className="sysmon-card-value">{ANCHORAN_VERSION}</div>
            </div>
            <div className="sysmon-card">
              <div className="sysmon-card-label">Processor</div>
              <div className="sysmon-card-value" style={{ fontSize: 13 }}>
                {info.cpuModel}
              </div>
              <div className="appcenter-status">{info.cpuCores} cores</div>
            </div>
            <div className="sysmon-card">
              <div className="sysmon-card-label">CPU Usage</div>
              <div className="sysmon-card-value">{info.cpuUsagePercent}%</div>
              <div className="sysmon-meter">
                <div className="sysmon-meter-fill" style={{ width: `${info.cpuUsagePercent}%` }} />
              </div>
            </div>
            <div className="sysmon-card">
              <div className="sysmon-card-label">Memory</div>
              <div className="sysmon-card-value">
                {usedMemMB} / {info.totalMemMB} MB
              </div>
              <div className="sysmon-meter">
                <div className="sysmon-meter-fill" style={{ width: `${memPercent}%` }} />
              </div>
            </div>
            <div className="sysmon-card">
              <div className="sysmon-card-label">System Uptime</div>
              <div className="sysmon-card-value">{formatUptime(info.systemUptimeSec)}</div>
            </div>
            <div className="sysmon-card">
              <div className="sysmon-card-label">Platform</div>
              <div className="sysmon-card-value" style={{ fontSize: 13 }}>
                {info.platform}
              </div>
              <div className="appcenter-status">{info.arch}</div>
            </div>
            {renderMemMB !== null && (
              <div className="sysmon-card">
                <div className="sysmon-card-label">Anchoran Renderer Memory</div>
                <div className="sysmon-card-value">{renderMemMB} MB</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
