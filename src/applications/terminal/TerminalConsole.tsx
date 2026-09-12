import { useEffect, useRef, useState } from "react";
import { useWindowStore } from "@/windowmanager/windowStore";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { useProfilesStore } from "@/core/profilesStore";
import { useSystemModeStore } from "@/desktop/systemModeStore";
import { WALLPAPERS } from "@/desktop/wallpapers";
import { ANCHORAN_VERSION } from "@/core/version";
import "@/applications/apps.css";

interface HistoryEntry {
  id: number;
  text: string;
}

let entryId = 0;

// "C:\Users" -> "C:\" (kept with its trailing backslash — a bare
// "C:" means "current directory on C:" to Windows, not the drive
// root, so dropping it here used to silently list the wrong folder).
function parentPath(p: string): string {
  const trimmed = p.replace(/\\+$/, "");
  const idx = trimmed.lastIndexOf("\\");
  if (idx < 0) return p;
  const parent = trimmed.slice(0, idx);
  return parent.length <= 2 ? `${parent}\\` : parent;
}

/** A bare drive-letter path ("C:\...") is used as-is; anything else is joined onto cwd. */
function resolvePath(cwd: string, target: string): string {
  return /^[A-Za-z]:[\\/]/.test(target) ? target : `${cwd}\\${target}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatUptime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/**
 * The actual terminal console — history, input, and every command.
 * Rendered two ways: as Anchoran's normal windowed Terminal app (see
 * Terminal.tsx, full window chrome, admin mode entered via the secret
 * "sudo" command), and raw with no window chrome at all inside the
 * crash screen (see core/ErrorBoundary.tsx), always already in admin
 * mode there since a crash is exactly when you'd need the deeper
 * commands and there's no normal desktop left to unlock it from.
 */
export function TerminalConsole({
  admin,
  onUnlockAdmin,
  canExitAdmin = true,
  greeting,
}: {
  admin: boolean;
  onUnlockAdmin?: () => void;
  canExitAdmin?: boolean;
  greeting?: string;
}) {
  const [isAdmin, setIsAdmin] = useState(admin);
  const [history, setHistory] = useState<HistoryEntry[]>([
    { id: entryId++, text: greeting ?? 'Anchoran OS Terminal. Type "help" to get started.' },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commandHistory = useRef<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);

  const openApp = useWindowStore((s) => s.openApp);
  const windows = useWindowStore((s) => s.windows);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const prefs = usePreferencesStore();
  const profiles = useProfilesStore((s) => s.profiles);
  const activeProfileId = useProfilesStore((s) => s.activeProfileId);
  const systemModeStart = useSystemModeStore((s) => s.start);
  const systemModeStop = useSystemModeStore((s) => s.stop);
  const awaitingUpdate = useRef(false);

  useEffect(() => {
    window.anchoran?.fsSpecialFolders().then((folders) => setCwd(folders.home));
  }, []);

  function print(text: string) {
    setHistory((h) => [...h, { id: entryId++, text }]);
  }

  useEffect(() => {
    window.anchoran?.onUpdateStatus((status) => {
      if (!awaitingUpdate.current) return;
      if (status.state === "checking") print("Checking for updates…");
      else if (status.state === "available") print(`Update available: v${status.version}. Downloading…`);
      else if (status.state === "not-available") {
        print("Anchoran is up to date.");
        awaitingUpdate.current = false;
      } else if (status.state === "downloading") {
        print(`Downloading update… ${status.percent}%`);
      } else if (status.state === "downloaded") {
        print(`Update v${status.version} downloaded. Restart Anchoran to install it (Power menu → Restart Anchoran).`);
        awaitingUpdate.current = false;
      } else if (status.state === "error") {
        print(`Update check failed: ${status.message}`);
        awaitingUpdate.current = false;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function completeTab() {
    if (!window.anchoran) return;
    const lastSpace = input.lastIndexOf(" ");
    const partial = input.slice(lastSpace + 1);
    const lastSlash = Math.max(partial.lastIndexOf("\\"), partial.lastIndexOf("/"));
    const dirPart = lastSlash >= 0 ? partial.slice(0, lastSlash) : "";
    const namePrefix = (lastSlash >= 0 ? partial.slice(lastSlash + 1) : partial).toLowerCase();
    const dir = dirPart ? resolvePath(cwd, dirPart) : cwd;
    const result = await window.anchoran.fsListDir(dir);
    if ("error" in result) return;
    const matches = result.entries.filter((e) => e.name.toLowerCase().startsWith(namePrefix));
    if (matches.length === 0) return;
    if (matches.length === 1) {
      const completedName = matches[0].name + (matches[0].isDirectory ? "\\" : "");
      const newPartial = (dirPart ? `${dirPart}\\` : "") + completedName;
      setInput(input.slice(0, lastSpace + 1) + newPartial);
    } else {
      print(matches.map((m) => (m.isDirectory ? `${m.name}\\` : m.name)).join("  "));
    }
  }

  async function run(raw: string) {
    const line = raw.trim();
    print(`${isAdmin ? "root@anchoran:~#" : "user@anchoran:~$"} ${raw}`);
    if (!line) return;

    const [cmd, ...args] = line.split(/\s+/);
    const rest = args.join(" ");

    // The secret unlock — deliberately not listed in `help`.
    if (cmd === "sudo") {
      if (isAdmin) {
        print("Already running as Administrator.");
      } else {
        setIsAdmin(true);
        onUnlockAdmin?.();
        print("Administrator Terminal unlocked. Type \"help\" to see the extra commands.");
      }
      return;
    }

    switch (cmd) {
      case "help":
        print(
          [
            "Available commands:",
            "  help, clear, about, system, date, echo, pwd, ls, cd, mkdir, touch, cat",
            "  del/rm, move/mv, copy/cp, find",
            "  anchoran system | anchoran version | anchoran settings | anchoran update",
            "Tab completes file and folder names.",
            ...(isAdmin
              ? [
                  "",
                  "Administrator commands:",
                  "  whoami, uptime, sysinfo, ps, taskkill <pid>, forcequit <app>, killall",
                  "  startup, startup remove <name>, systemmode on|off",
                  "  df, emptyrecyclebin, clearcache, backup, restore, wipe --confirm",
                  "  theme light|dark, wallpaper <name>, accent <hex>, scale <value>",
                  "  logs, logs --errors, changeto",
                  ...(canExitAdmin ? ["  exit — drop back to a normal Terminal"] : []),
                ]
              : []),
          ].join("\n")
        );
        break;
      case "clear":
        setHistory([]);
        break;
      case "about":
        print(`Anchoran OS ${ANCHORAN_VERSION} — a minimal, focused desktop environment.${isAdmin ? " (Administrator Terminal)" : ""}`);
        break;
      case "system":
        print(`Anchoran OS ${ANCHORAN_VERSION}\nPlatform: ${navigator.platform}`);
        break;
      case "date":
        print(new Date().toString());
        break;
      case "echo":
        print(rest);
        break;
      case "pwd":
        print(cwd);
        break;
      case "ls": {
        const result = await window.anchoran?.fsListDir(cwd);
        if (!result) print("ls: not available outside the Anchoran desktop app.");
        else if ("error" in result) print(`ls: ${result.error}`);
        else print(result.entries.map((n) => (n.isDirectory ? `${n.name}\\` : n.name)).join("  "));
        break;
      }
      case "cd": {
        if (!args[0] || args[0] === "~") {
          const folders = await window.anchoran?.fsSpecialFolders();
          if (folders) setCwd(folders.home);
          break;
        }
        const target = args[0] === ".." ? parentPath(cwd) : resolvePath(cwd, args[0]);
        const result = await window.anchoran?.fsListDir(target);
        if (result && !("error" in result)) setCwd(target);
        else print(`cd: no such directory: ${args[0]}`);
        break;
      }
      case "mkdir":
        if (!args[0]) print("mkdir: missing folder name");
        else {
          const result = await window.anchoran?.fsCreateFolder(cwd, args[0]);
          if (result && "error" in result) print(`mkdir: ${result.error}`);
        }
        break;
      case "touch":
        if (!args[0]) print("touch: missing file name");
        else {
          const result = await window.anchoran?.fsCreateFile(cwd, args[0], "");
          if (result && "error" in result) print(`touch: ${result.error}`);
        }
        break;
      case "cat": {
        if (!args[0]) {
          print("cat: missing file name");
          break;
        }
        const result = await window.anchoran?.fsReadTextFile(resolvePath(cwd, args[0]));
        if (result && "content" in result) print(result.content);
        else print(`cat: no such file: ${args[0]}`);
        break;
      }
      case "del":
      case "rm": {
        if (!args[0]) {
          print(`${cmd}: missing file or folder name`);
          break;
        }
        const target = resolvePath(cwd, args[0]);
        const result = await window.anchoran?.fsDelete([target]);
        if (!result) print(`${cmd}: not available outside the Anchoran desktop app.`);
        else if (!result.success) print(`${cmd}: ${result.error}`);
        break;
      }
      case "move":
      case "mv": {
        if (!args[0] || !args[1]) {
          print(`${cmd}: usage: ${cmd} <source> <destination folder>`);
          break;
        }
        const source = resolvePath(cwd, args[0]);
        const destDir = resolvePath(cwd, args[1]);
        const result = await window.anchoran?.fsMove([source], destDir);
        if (!result) print(`${cmd}: not available outside the Anchoran desktop app.`);
        else if (!result.success) print(`${cmd}: ${result.error}`);
        break;
      }
      case "copy":
      case "cp": {
        if (!args[0] || !args[1]) {
          print(`${cmd}: usage: ${cmd} <source> <destination folder>`);
          break;
        }
        const source = resolvePath(cwd, args[0]);
        const destDir = resolvePath(cwd, args[1]);
        const result = await window.anchoran?.fsCopy([source], destDir);
        if (!result) print(`${cmd}: not available outside the Anchoran desktop app.`);
        else if (!result.success) print(`${cmd}: ${result.error}`);
        break;
      }
      case "find": {
        if (!args[0]) {
          print("find: missing search text");
          break;
        }
        if (!window.anchoran) {
          print("find: not available outside the Anchoran desktop app.");
          break;
        }
        const needle = args[0].toLowerCase();
        const matches: string[] = [];
        async function scan(dir: string, depth: number) {
          if (matches.length >= 100 || depth > 8) return;
          const result = await window.anchoran!.fsListDir(dir);
          if ("error" in result) return;
          for (const entry of result.entries) {
            if (matches.length >= 100) return;
            if (entry.name.toLowerCase().includes(needle)) matches.push(entry.path);
            if (entry.isDirectory) await scan(entry.path, depth + 1);
          }
        }
        await scan(cwd, 0);
        print(matches.length > 0 ? matches.join("\n") : "find: no matches");
        break;
      }
      case "anchoran": {
        const sub = args[0];
        if (sub === "system") print(`Anchoran OS ${ANCHORAN_VERSION}`);
        else if (sub === "version") print(ANCHORAN_VERSION);
        else if (sub === "settings") {
          openApp("settings");
          print("Opening Settings…");
        } else if (sub === "update") {
          if (window.anchoran) {
            awaitingUpdate.current = true;
            window.anchoran.checkForUpdates();
          } else {
            print("anchoran update: not available outside the Anchoran desktop app.");
          }
        } else {
          print("anchoran: unknown subcommand. Try: system, version, settings, update");
        }
        break;
      }

      // ---- Administrator-only commands ----
      case "whoami": {
        if (!isAdmin) break;
        const active = profiles.find((p) => p.id === activeProfileId);
        print(`${active?.name ?? prefs.username} (${activeProfileId || "no profile"})${prefs.lockPin ? " — PIN set" : " — no PIN"}`);
        break;
      }
      case "uptime": {
        if (!isAdmin) break;
        const info = await window.anchoran?.getSystemInfo();
        print(info ? formatUptime(info.systemUptimeSec) : "uptime: not available outside the Anchoran desktop app.");
        break;
      }
      case "sysinfo": {
        if (!isAdmin) break;
        const info = await window.anchoran?.getSystemInfo();
        if (!info) {
          print("sysinfo: not available outside the Anchoran desktop app.");
          break;
        }
        print(
          `${info.cpuModel} (${info.cpuCores} cores) — CPU ${info.cpuUsagePercent}%\n` +
            `Memory: ${info.totalMemMB - info.freeMemMB} / ${info.totalMemMB} MB\n` +
            `Platform: ${info.platform} ${info.arch}`
        );
        break;
      }
      case "ps":
      case "pslist": {
        if (!isAdmin) break;
        const list = await window.anchoran?.listProcesses();
        if (!list) print("ps: not available outside the Anchoran desktop app.");
        else print(list.map((p) => `${String(p.pid).padStart(6)}  ${p.name}`).join("\n"));
        break;
      }
      case "taskkill": {
        if (!isAdmin) break;
        const pid = Number(args[0]);
        if (!pid) {
          print("taskkill: usage: taskkill <pid>");
          break;
        }
        const result = await window.anchoran?.killProcess(pid);
        if (!result) print("taskkill: not available outside the Anchoran desktop app.");
        else if (!result.success) print(`taskkill: ${result.error}`);
        else print(`Ended process ${pid}.`);
        break;
      }
      case "forcequit": {
        if (!isAdmin) break;
        if (!args[0]) {
          print("forcequit: usage: forcequit <app id>");
          break;
        }
        const matches = windows.filter((w) => w.appId === args[0]);
        if (matches.length === 0) print(`forcequit: no open windows for "${args[0]}".`);
        else {
          matches.forEach((w) => closeWindow(w.windowId));
          print(`Closed ${matches.length} window(s) for "${args[0]}".`);
        }
        break;
      }
      case "killall": {
        if (!isAdmin) break;
        windows.forEach((w) => closeWindow(w.windowId));
        print(`Closed ${windows.length} window(s).`);
        break;
      }
      case "startup": {
        if (!isAdmin) break;
        if (args[0] === "remove") {
          if (!args[1]) {
            print("startup remove: usage: startup remove <name>");
            break;
          }
          const result = await window.anchoran?.removeStartupItem(args.slice(1).join(" "));
          if (!result) print("startup: not available outside the Anchoran desktop app.");
          else if (!result.success) print(`startup remove: ${result.error}`);
          else print("Removed.");
          break;
        }
        const items = await window.anchoran?.listStartupItems();
        if (!items) print("startup: not available outside the Anchoran desktop app.");
        else if (items.length === 0) print("Nothing set to start up.");
        else print(items.map((i) => `${i.name}${i.exists ? "" : " (target not found)"}`).join("\n"));
        break;
      }
      case "systemmode": {
        if (!isAdmin) break;
        if (args[0] === "on") {
          await systemModeStart();
          const err = useSystemModeStore.getState().error;
          print(err ? `systemmode: ${err}` : "System Mode started.");
        } else if (args[0] === "off") {
          await systemModeStop();
          print("System Mode stopped.");
        } else print("systemmode: usage: systemmode on|off");
        break;
      }
      case "df": {
        if (!isAdmin) break;
        const usage = await window.anchoran?.getDiskUsage();
        if (!usage || usage.drives.length === 0) print("df: not available outside the Anchoran desktop app.");
        else
          print(
            usage.drives
              .map((d) => `${d.caption}  ${formatBytes(d.total - d.free)} used of ${formatBytes(d.total)}`)
              .join("\n")
          );
        break;
      }
      case "emptyrecyclebin": {
        if (!isAdmin) break;
        const result = await window.anchoran?.emptyRecycleBin();
        if (!result) print("emptyrecyclebin: not available outside the Anchoran desktop app.");
        else print(result.success ? "Recycle Bin emptied." : `emptyrecyclebin: ${result.error}`);
        break;
      }
      case "clearcache": {
        if (!isAdmin) break;
        const result = await window.anchoran?.clearCache();
        if (!result) print("clearcache: not available outside the Anchoran desktop app.");
        else print(result.success ? `Cleared ${formatBytes(result.freedBytes ?? 0)}.` : `clearcache: ${result.error}`);
        break;
      }
      case "backup": {
        if (!isAdmin) break;
        const result = await window.anchoran?.exportData();
        if (!result) print("backup: not available outside the Anchoran desktop app.");
        else print(result.success ? `Exported to ${result.path}.` : "Cancelled.");
        break;
      }
      case "restore": {
        if (!isAdmin) break;
        const result = await window.anchoran?.importData();
        if (!result) print("restore: not available outside the Anchoran desktop app.");
        else if (result.success) print("Restored — restart Anchoran for it to fully take effect.");
        else print(result.error ? `restore: ${result.error}` : "Cancelled.");
        break;
      }
      case "wipe": {
        if (!isAdmin) break;
        if (args[0] !== "--confirm") {
          print("wipe: this resets Anchoran to factory defaults and cannot be undone. Run \"wipe --confirm\" to actually do it.");
          break;
        }
        const result = await window.anchoran?.resetData();
        print(result ? "Anchoran has been reset. Restart to complete it." : "wipe: not available outside the Anchoran desktop app.");
        break;
      }
      case "theme": {
        if (!isAdmin) break;
        if (args[0] === "light" || args[0] === "dark") {
          prefs.setThemeMode(args[0]);
          print(`Theme set to ${args[0]}.`);
        } else print("theme: usage: theme light|dark");
        break;
      }
      case "wallpaper": {
        if (!isAdmin) break;
        const match = WALLPAPERS.find((w) => w.name.toLowerCase() === rest.toLowerCase() || w.id === rest.toLowerCase());
        if (!match) {
          print(`wallpaper: no wallpaper named "${rest}". Try: ${WALLPAPERS.map((w) => w.name).join(", ")}`);
          break;
        }
        prefs.setWallpaper(match.id);
        print(`Wallpaper set to ${match.name}.`);
        break;
      }
      case "accent": {
        if (!isAdmin) break;
        if (!/^#[0-9a-fA-F]{6}$/.test(args[0] ?? "")) {
          print("accent: usage: accent #RRGGBB");
          break;
        }
        prefs.setAccentColor(args[0]);
        print(`Accent color set to ${args[0]}.`);
        break;
      }
      case "scale": {
        if (!isAdmin) break;
        const value = Number(args[0]);
        if (!value || value < 0.5 || value > 2) {
          print("scale: usage: scale <0.5–2>");
          break;
        }
        prefs.setUiScale(value);
        print(`Interface scale set to ${value}.`);
        break;
      }
      case "logs": {
        if (!isAdmin) break;
        const lines = await window.anchoran?.readLog();
        if (!lines) {
          print("logs: not available outside the Anchoran desktop app.");
          break;
        }
        const filtered = args[0] === "--errors" ? lines.filter((l) => /error|exception/i.test(l)) : lines;
        print(filtered.slice(0, 30).join("\n") || "No matching log entries.");
        break;
      }
      case "changeto": {
        if (!isAdmin) break;
        if (!window.anchoran) {
          print("changeto: not available outside the Anchoran desktop app.");
          break;
        }
        print("Fetching available releases…");
        try {
          const res = await fetch("https://api.github.com/repos/fachu2012/Anchoran-OS/releases?per_page=100");
          const data: { tag_name: string; body: string | null; draft: boolean; prerelease: boolean }[] = await res.json();
          const installable = data
            .filter((r) => !r.draft && !r.prerelease && typeof r.body === "string" && !r.body.includes("installation option has been disabled"))
            .map((r) => r.tag_name.replace(/^v/i, ""));
          if (!args[0]) {
            print(
              installable.length > 0
                ? installable.map((v) => `  ${v}${v === ANCHORAN_VERSION ? " (current)" : ""}`).join("\n")
                : "Couldn't fetch the release list."
            );
          } else {
            const target = args[0].replace(/^v/i, "");
            if (!installable.includes(target)) {
              print(`changeto: v${target} isn't an installable release. Run "changeto" with no arguments to see the list.`);
            } else {
              print(
                `changeto: switching versions isn't wired up to actually install yet in this build — ` +
                  `v${target} is a valid, installable release though. Download it manually from the Releases page for now.`
              );
            }
          }
        } catch {
          print("changeto: couldn't reach GitHub.");
        }
        break;
      }
      case "exit": {
        if (!isAdmin) break;
        if (!canExitAdmin) {
          print("exit: this session has no normal mode.");
          break;
        }
        setIsAdmin(false);
        print("Back to a normal Terminal.");
        break;
      }

      default:
        print(`${cmd}: command not found`);
    }
  }

  return (
    <div className="terminal-root" data-admin={isAdmin} onClick={() => inputRef.current?.focus()}>
      {history.map((entry) => (
        <div key={entry.id} className="terminal-line">
          {entry.text}
        </div>
      ))}
      <div className="terminal-prompt-row">
        <span className="terminal-prompt-label">{isAdmin ? "root@anchoran:~#" : "user@anchoran:~$"}</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={input}
          autoFocus
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              completeTab();
              return;
            }
            if (e.key === "Enter") {
              if (input.trim()) commandHistory.current.push(input);
              setHistoryCursor(null);
              run(input);
              setInput("");
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              if (commandHistory.current.length === 0) return;
              const nextCursor = historyCursor === null ? commandHistory.current.length - 1 : Math.max(0, historyCursor - 1);
              setHistoryCursor(nextCursor);
              setInput(commandHistory.current[nextCursor]);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (historyCursor === null) return;
              const nextCursor = historyCursor + 1;
              if (nextCursor >= commandHistory.current.length) {
                setHistoryCursor(null);
                setInput("");
              } else {
                setHistoryCursor(nextCursor);
                setInput(commandHistory.current[nextCursor]);
              }
            }
          }}
        />
      </div>
    </div>
  );
}
