import { useEffect, useState } from "react";
import { ANCHORAN_VERSION } from "@/core/version";
import { useWindowStore } from "@/windowmanager/windowStore";
import { APP_REGISTRY } from "@/applications/registry";
import { Icon, type IconName } from "@/components/Icon";
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
  const windows = useWindowStore((s) => s.windows);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);

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
        <div className="sysmon-processes">
          <div className="sysmon-card-label" style={{ marginBottom: 8 }}>
            Running Apps ({windows.length})
          </div>
          {windows.length === 0 ? (
            <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>No apps are running.</div>
          ) : (
            <div className="sysmon-process-list">
              {windows.map((w) => (
                <div key={w.windowId} className="sysmon-process-row">
                  <Icon name={APP_REGISTRY[w.appId].icon as IconName} size={15} />
                  <span className="sysmon-process-title" onClick={() => focusWindow(w.windowId)}>
                    {w.title}
                  </span>
                  {w.isMinimized && <span className="sysmon-process-tag">Minimized</span>}
                  <button className="app-toolbar-btn" onClick={() => closeWindow(w.windowId)}>
                    End task
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
