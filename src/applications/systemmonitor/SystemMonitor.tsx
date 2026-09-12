import { useEffect, useState } from "react";
import { ANCHORAN_VERSION } from "@/core/version";
import { useWindowStore } from "@/windowmanager/windowStore";
import { APP_REGISTRY } from "@/applications/registry";
import { Icon, type IconName } from "@/components/Icon";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";

interface RealProcess {
  pid: number;
  parentPid: number;
  name: string;
}

interface ProcessNode extends RealProcess {
  children: ProcessNode[];
}

function buildProcessTree(processes: RealProcess[]): ProcessNode[] {
  const byPid = new Map<number, ProcessNode>();
  for (const p of processes) byPid.set(p.pid, { ...p, children: [] });
  const roots: ProcessNode[] = [];
  for (const node of byPid.values()) {
    const parent = byPid.get(node.parentPid);
    if (parent && parent.pid !== node.pid) parent.children.push(node);
    else roots.push(node);
  }
  return roots.sort((a, b) => a.name.localeCompare(b.name));
}

function ProcessTreeRow({ node, depth, onKill }: { node: ProcessNode; depth: number; onKill: (pid: number, name: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 1);
  return (
    <>
      <div className="sysmon-process-row" style={{ paddingLeft: depth * 16 }}>
        {node.children.length > 0 ? (
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{ border: "none", background: "transparent", color: "var(--anchoran-text-secondary)", cursor: "pointer", padding: 0 }}
          >
            <Icon name="chevronRight" size={11} style={{ transform: expanded ? "rotate(90deg)" : undefined }} />
          </button>
        ) : (
          <span style={{ width: 11 }} />
        )}
        <span className="sysmon-process-title" style={{ cursor: "default" }}>
          {node.name}
        </span>
        <span className="sysmon-process-tag">PID {node.pid}</span>
        <button className="app-toolbar-btn" onClick={() => onKill(node.pid, node.name)}>
          End task
        </button>
      </div>
      {expanded && node.children.map((child) => <ProcessTreeRow key={child.pid} node={child} depth={depth + 1} onKill={onKill} />)}
    </>
  );
}

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

/** A minimal rolling history bar chart — no charting library needed for ~40 points. */
function HistorySparkline({ values }: { values: number[] }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 24, marginTop: 6 }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(2, v)}%`,
            background: "var(--anchoran-accent)",
            opacity: 0.4 + (i / values.length) * 0.6,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
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
  const pushNotification = useNotificationStore((s) => s.push);
  const [view, setView] = useState<"apps" | "processes">("apps");
  const [processes, setProcesses] = useState<RealProcess[] | null>(null);

  async function loadProcesses() {
    if (!window.anchoran) return;
    setProcesses(await window.anchoran.listProcesses());
  }

  useEffect(() => {
    if (view === "processes") loadProcesses();
  }, [view]);

  async function killRealProcess(pid: number, name: string) {
    if (!window.confirm(`End "${name}" (PID ${pid})? This affects the real system, not just Anchoran.`)) return;
    const result = await window.anchoran!.killProcess(pid);
    if (!result.success) pushNotification("System Monitor", result.error ?? "Couldn't end that process.");
    loadProcesses();
  }

  const HISTORY_LENGTH = 40;
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (window.anchoran) {
        const data = await window.anchoran.getSystemInfo();
        if (!cancelled) {
          setInfo(data);
          setCpuHistory((h) => [...h, data.cpuUsagePercent].slice(-HISTORY_LENGTH));
          const usedPct = Math.round(((data.totalMemMB - data.freeMemMB) / data.totalMemMB) * 100);
          setMemHistory((h) => [...h, usedPct].slice(-HISTORY_LENGTH));
        }
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button className="app-toolbar-btn" data-op={view === "apps"} onClick={() => setView("apps")}>
              Anchoran Apps ({windows.length})
            </button>
            <button className="app-toolbar-btn" data-op={view === "processes"} onClick={() => setView("processes")}>
              All Processes {processes ? `(${processes.length})` : ""}
            </button>
            {view === "processes" && (
              <button className="app-toolbar-btn" onClick={loadProcesses} style={{ marginLeft: "auto" }}>
                <Icon name="restart" size={12} /> Refresh
              </button>
            )}
          </div>
          {view === "apps" ? (
            windows.length === 0 ? (
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
            )
          ) : processes === null ? (
            <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>
              Only available inside the Anchoran desktop app.
            </div>
          ) : (
            <div className="sysmon-process-list" style={{ maxHeight: 260, overflowY: "auto" }}>
              {buildProcessTree(processes).map((node) => (
                <ProcessTreeRow key={node.pid} node={node} depth={0} onKill={killRealProcess} />
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
              <HistorySparkline values={cpuHistory} />
            </div>
            <div className="sysmon-card">
              <div className="sysmon-card-label">Memory</div>
              <div className="sysmon-card-value">
                {usedMemMB} / {info.totalMemMB} MB
              </div>
              <div className="sysmon-meter">
                <div className="sysmon-meter-fill" style={{ width: `${memPercent}%` }} />
              </div>
              <HistorySparkline values={memHistory} />
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
