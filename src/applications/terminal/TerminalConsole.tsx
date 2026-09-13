import { useEffect, useRef, useState } from "react";
import { persistGet, persistSet } from "@/core/persist";
import { useWindowStore } from "@/windowmanager/windowStore";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { useProfilesStore } from "@/core/profilesStore";
import { useSystemModeStore } from "@/desktop/systemModeStore";
import { useInstalledAppsStore } from "@/applications/installedAppsStore";
import { APP_LIST } from "@/applications/registry";
import { WALLPAPERS } from "@/desktop/wallpapers";
import { ANCHORAN_VERSION } from "@/core/version";
import { getAppUptimeSeconds } from "@/core/appUptime";
import type { AppId } from "@/core/types";
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

/** Matches an app by its internal id or its display title (case-insensitive) — what a user actually types is the title, most of the time. */
function findApp(query: string) {
  const q = query.toLowerCase();
  return APP_LIST.find((a) => a.id.toLowerCase() === q || a.title.toLowerCase() === q);
}

/**
 * The actual terminal console — history, input, and every command.
 * Rendered two ways: as Anchoran's normal windowed Terminal app (see
 * Terminal.tsx, full window chrome, admin mode only ever entered
 * pre-elevated via "Run as Administrator" + a real admin PIN check —
 * there is deliberately no in-terminal command that grants it, since
 * that would be an admin shell with no authentication at all), and raw
 * with no window chrome at all inside the crash screen (see
 * core/ErrorBoundary.tsx), always already in admin mode there since a
 * crash is exactly when you'd need the deeper commands and there's no
 * normal desktop left to unlock it from.
 */
export function TerminalConsole({
  admin,
  canExitAdmin = true,
  greeting,
  windowId,
}: {
  admin: boolean;
  canExitAdmin?: boolean;
  greeting?: string;
  /** This window's id in windowStore, when rendered as a real window (not the crash screen) — used only to refocus the input whenever this Terminal becomes the focused window. */
  windowId?: string;
}) {
  const [isAdmin, setIsAdmin] = useState(admin);
  const [history, setHistory] = useState<HistoryEntry[]>([
    { id: entryId++, text: greeting ?? 'Anchoran OS Terminal. Type "help" to get started.' },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commandHistory = useRef<string[]>([]);
  // Command history and user-defined aliases both persist across
  // sessions now — a fresh Terminal window used to start with a
  // completely blank ↑-history and forget any `alias` you'd set.
  const aliases = useRef<Record<string, string>>({});
  useEffect(() => {
    persistGet<string[]>("config", "terminalHistory", []).then((saved) => {
      commandHistory.current = saved;
    });
    persistGet<Record<string, string>>("config", "terminalAliases", {}).then((saved) => {
      aliases.current = saved;
    });
  }, []);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);

  const openApp = useWindowStore((s) => s.openApp);
  const windows = useWindowStore((s) => s.windows);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const isFocusedWindow = useWindowStore((s) => !windowId || s.focusedWindowId === windowId);
  const prefs = usePreferencesStore();
  const profiles = useProfilesStore((s) => s.profiles);
  const activeProfileId = useProfilesStore((s) => s.activeProfileId);
  const systemModeStart = useSystemModeStore((s) => s.start);
  const systemModeStop = useSystemModeStore((s) => s.stop);
  const installedApps = useInstalledAppsStore((s) => s.installed);
  const installApp = useInstalledAppsStore((s) => s.install);
  const uninstallApp = useInstalledAppsStore((s) => s.uninstall);
  const deleteProfile = useProfilesStore((s) => s.deleteProfile);
  const awaitingUpdate = useRef(false);
  const awaitingChangeTo = useRef(false);
  const pendingChangeTo = useRef<string | null>(null);
  // Which version is currently downloading — read by the "downloaded"
  // status handler below (which fires from an IPC event with no version
  // of its own) to know which version to ask App.tsx's cinematic for.
  const pendingChangeToInstallVersion = useRef<string | null>(null);
  // The line currently being live-updated in place (a download's
  // percent ticking up) rather than appended as a new line each time —
  // set while one is in progress, cleared once it's done so the next
  // printed line (or the next download) starts fresh.
  const progressLineId = useRef<number | null>(null);

  useEffect(() => {
    window.anchoran?.fsSpecialFolders().then((folders) => setCwd(folders.home));
  }, []);

  // Belt-and-suspenders alongside the input's own `autoFocus`: in a
  // window that can be mid-open-animation, reparented, or otherwise
  // not yet laid out at the exact moment React applies `autoFocus`,
  // that attribute can silently fail to actually move focus — leaving
  // every keystroke going nowhere with no visible error. An explicit
  // focus() after mount (and once more shortly after, past any
  // entrance transition) costs nothing and closes that gap. Also
  // refocuses whenever this window becomes the focused one (clicking
  // its taskbar icon, Ctrl+Tab, …) — the window store's own idea of
  // "focused" is just app state and doesn't move real DOM focus by
  // itself.
  useEffect(() => {
    if (!isFocusedWindow) return;
    inputRef.current?.focus();
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [isFocusedWindow]);

  function print(text: string) {
    progressLineId.current = null;
    setHistory((h) => [...h, { id: entryId++, text }]);
  }

  /** Like print(), but keeps rewriting the same line instead of appending a new one, for live progress (a download's percent, …). */
  function printProgress(text: string) {
    setHistory((h) => {
      if (progressLineId.current !== null) {
        return h.map((e) => (e.id === progressLineId.current ? { ...e, text } : e));
      }
      const id = entryId++;
      progressLineId.current = id;
      return [...h, { id, text }];
    });
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
        printProgress(`Downloading update… ${status.percent}%`);
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

  useEffect(() => {
    window.anchoran?.onChangeToStatus((status) => {
      if (!awaitingChangeTo.current) return;
      if (status.state === "downloading") {
        printProgress(`Downloading… ${status.percent}%`);
      } else if (status.state === "downloaded") {
        print("Download complete.");
        awaitingChangeTo.current = false;
        window.dispatchEvent(new CustomEvent("anchoran-request-changeto-theater", { detail: pendingChangeToInstallVersion.current }));
      } else if (status.state === "installing") {
        print("Installing — Anchoran will restart shortly to finish.");
      } else if (status.state === "error") {
        print(`changeto: ${status.message}`);
        awaitingChangeTo.current = false;
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

    // A "changeto" confirmation is pending — this line answers it
    // instead of being parsed as a new command.
    if (pendingChangeTo.current) {
      const version = pendingChangeTo.current;
      pendingChangeTo.current = null;
      const answer = line.toLowerCase();
      if (answer === "y" || answer === "yes" || answer === "s" || answer === "si" || answer === "sí") {
        if (!window.anchoran) {
          print("changeto: not available outside the Anchoran desktop app.");
          return;
        }
        awaitingChangeTo.current = true;
        pendingChangeToInstallVersion.current = version;
        print(`Downloading v${version}…`);
        const result = await window.anchoran.changeToDownload(version);
        if (!result.success) {
          awaitingChangeTo.current = false;
          print(`changeto: ${result.error ?? "failed."}`);
        }
      } else {
        print("changeto: cancelled.");
      }
      return;
    }

    // An alias expands to its full definition before anything else
    // touches the line — recursion-safe up to a handful of hops so a
    // typo'd self-referencing alias can't hang the terminal.
    let expanded = line;
    for (let hops = 0; hops < 5; hops++) {
      const firstWord = expanded.split(/\s+/)[0];
      const def = aliases.current[firstWord];
      if (!def) break;
      expanded = def + expanded.slice(firstWord.length);
    }
    const [cmd, ...args] = expanded.split(/\s+/);
    const rest = args.join(" ");

    if (cmd === "alias") {
      if (!rest) {
        const entries = Object.entries(aliases.current);
        print(entries.length ? entries.map(([k, v]) => `${k}='${v}'`).join("\n") : "No aliases set.");
      } else if (rest === "--remove" || args[0] === "--remove") {
        const name = args[1];
        if (!name || !aliases.current[name]) {
          print(`alias: no alias named "${name ?? ""}".`);
        } else {
          delete aliases.current[name];
          persistSet("config", "terminalAliases", aliases.current);
          print(`Removed alias "${name}".`);
        }
      } else {
        const eq = rest.indexOf("=");
        if (eq < 0) {
          print('alias: usage: alias name="command" or alias --remove name');
        } else {
          const name = rest.slice(0, eq).trim();
          const value = rest.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
          if (!name || !value) {
            print('alias: usage: alias name="command"');
          } else {
            aliases.current = { ...aliases.current, [name]: value };
            persistSet("config", "terminalAliases", aliases.current);
            print(`Alias "${name}" set to "${value}".`);
          }
        }
      }
      return;
    }

    switch (cmd) {
      case "help":
        print(
          [
            "Available commands:",
            "  help, clear, about, system, date, echo, pwd, ls, cd, mkdir, touch, cat",
            "  del/rm, move/mv, copy/cp, find, history, alias name=\"cmd\" | alias --remove name",
            "  anchoran system | version | settings | update | changelog [vX.Y.Z] | uptime",
            "  anchoran restart | lock | apps | open <app> | install <app> | uninstall <app> | kill <app>",
            "Tab completes file and folder names.",
            ...(isAdmin
              ? [
                  "",
                  "Administrator commands:",
                  "  whoami, uptime, sysinfo, ps, taskkill <pid>, forcequit <app>, killall",
                  "  startup, startup remove <name>, systemmode on|off",
                  "  df, du <path>, emptyrecyclebin, clearcache, backup, restore, wipe --confirm",
                  "  theme light|dark, wallpaper <name>, accent <hex>, scale <value>",
                  "  logs, logs --errors, crashinfo, exportlogs, anchoran changeto [vX.Y.Z]",
                  "  shutdown, restart, sleep, resetpin --confirm",
                  "  listprofiles, delprofile <id>, regquery <key>",
                  "  netcheck, ping <host>, myip",
                  "  listwindows, closewindow <id>, resetlayout, restartexplorer",
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
        const subArgs = args.slice(1);
        const subRest = subArgs.join(" ");
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
        } else if (sub === "uptime") {
          print(formatUptime(getAppUptimeSeconds()) + " (this Anchoran session)");
        } else if (sub === "changelog") {
          print("Fetching the changelog…");
          try {
            const res = await fetch("https://raw.githubusercontent.com/fachu2012/Anchoran-OS/main/CHANGELOG.md");
            const text = await res.text();
            const wantedVersion = (subArgs[0] ?? ANCHORAN_VERSION).replace(/^v/i, "");
            const lines = text.split(/\r?\n/);
            const startIndex = lines.findIndex((l) => l.startsWith(`## [${wantedVersion}]`));
            if (startIndex < 0) {
              print(`anchoran changelog: no entry for v${wantedVersion}.`);
            } else {
              const endIndex = lines.findIndex((l, i) => i > startIndex && l.startsWith("## ["));
              print(lines.slice(startIndex, endIndex < 0 ? undefined : endIndex).join("\n").trim());
            }
          } catch {
            print("anchoran changelog: couldn't reach GitHub.");
          }
        } else if (sub === "restart") {
          window.dispatchEvent(new Event("anchoran-request-restart"));
        } else if (sub === "lock") {
          window.dispatchEvent(new Event("anchoran-request-lock"));
        } else if (sub === "apps") {
          const list = APP_LIST.filter((a) => installedApps.has(a.id)).map((a) => a.title);
          print(list.join("\n"));
        } else if (sub === "install" || sub === "uninstall") {
          const app = findApp(subRest);
          if (!app) {
            print(`anchoran ${sub}: no app named "${subRest}".`);
          } else if (sub === "install") {
            installApp(app.id);
            print(`Installed ${app.title}.`);
          } else {
            uninstallApp(app.id);
            print(`Uninstalled ${app.title}.`);
          }
        } else if (sub === "open") {
          const app = findApp(subRest);
          if (!app) print(`anchoran open: no app named "${subRest}".`);
          else {
            openApp(app.id);
            print(`Opening ${app.title}…`);
          }
        } else if (sub === "kill") {
          const app = findApp(subRest);
          if (!app) {
            print(`anchoran kill: no app named "${subRest}".`);
          } else {
            const matches = windows.filter((w) => w.appId === app.id);
            matches.forEach((w) => closeWindow(w.windowId));
            print(matches.length > 0 ? `Closed ${matches.length} window(s) for ${app.title}.` : `${app.title} isn't open.`);
          }
        } else if (sub === "changeto") {
          if (!isAdmin) {
            print("anchoran changeto: administrator required. Reopen the Terminal via \"Run as Administrator\".");
            break;
          }
          if (!window.anchoran) {
            print("anchoran changeto: not available outside the Anchoran desktop app.");
            break;
          }
          print("Fetching available releases…");
          try {
            const res = await fetch("https://api.github.com/repos/fachu2012/Anchoran-OS/releases?per_page=100");
            const data: { tag_name: string; body: string | null; draft: boolean; prerelease: boolean }[] = await res.json();
            const installable = data
              .filter((r) => !r.draft && !r.prerelease && typeof r.body === "string" && !r.body.includes("installation option has been disabled"))
              .map((r) => r.tag_name.replace(/^v/i, ""));
            if (!subArgs[0]) {
              print(
                installable.length > 0
                  ? installable.map((v) => `  ${v}${v === ANCHORAN_VERSION ? " (current)" : ""}`).join("\n")
                  : "Couldn't fetch the release list."
              );
            } else {
              const target = subArgs[0].replace(/^v/i, "");
              if (!installable.includes(target)) {
                print(`anchoran changeto: v${target} isn't an installable release. Run "anchoran changeto" with no arguments to see the list.`);
              } else if (target === ANCHORAN_VERSION) {
                print(`anchoran changeto: v${target} is already the version running.`);
              } else {
                pendingChangeTo.current = target;
                print(`Change to v${target}? Anchoran will close and reopen on that version. [y/n]`);
              }
            }
          } catch {
            print("anchoran changeto: couldn't reach GitHub.");
          }
        } else {
          print(
            "anchoran: unknown subcommand. Try: system, version, settings, update, uptime, changelog, restart, lock, apps, install, uninstall, open, kill" +
              (isAdmin ? ", changeto" : "")
          );
        }
        break;
      }
      case "history":
        print(commandHistory.current.map((h, i) => `${i + 1}  ${h}`).join("\n") || "No commands yet.");
        break;

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
      case "crashinfo": {
        if (!isAdmin) break;
        const lines = await window.anchoran?.readLog();
        if (!lines) {
          print("crashinfo: not available outside the Anchoran desktop app.");
          break;
        }
        const lastCrash = lines.find((l) => l.includes("renderer:react"));
        print(lastCrash ? lastCrash : "No crash recorded since Anchoran's log started.");
        break;
      }
      case "exportlogs": {
        if (!isAdmin) break;
        if (!window.anchoran) {
          print("exportlogs: not available outside the Anchoran desktop app.");
          break;
        }
        const lines = await window.anchoran.readLog();
        const folders = await window.anchoran.fsSpecialFolders();
        const name = `anchoran-log-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
        const write = await window.anchoran.fsWriteTextFile(`${folders.desktop}\\${name}`, lines.join("\n"));
        print(write.success ? `Exported to Desktop\\${name}.` : `exportlogs: ${write.error}`);
        break;
      }
      case "shutdown": {
        if (!isAdmin) break;
        window.dispatchEvent(new Event("anchoran-request-shutdown"));
        break;
      }
      case "restart": {
        if (!isAdmin) break;
        window.dispatchEvent(new Event("anchoran-request-restart"));
        break;
      }
      case "sleep": {
        if (!isAdmin) break;
        window.dispatchEvent(new Event("anchoran-request-sleep"));
        break;
      }
      case "resetpin": {
        if (!isAdmin) break;
        if (args[0] !== "--confirm") {
          print('resetpin: this removes the lock PIN without asking for the current one. Run "resetpin --confirm" to actually do it.');
          break;
        }
        prefs.setLockPin(null);
        print("PIN removed.");
        break;
      }
      case "listprofiles": {
        if (!isAdmin) break;
        print(profiles.map((p) => `${p.id === activeProfileId ? "*" : " "} ${p.name} (${p.id})`).join("\n") || "No profiles.");
        break;
      }
      case "delprofile": {
        if (!isAdmin) break;
        if (!args[0]) {
          print("delprofile: usage: delprofile <id>");
          break;
        }
        if (!profiles.some((p) => p.id === args[0])) {
          print(`delprofile: no profile with id "${args[0]}".`);
          break;
        }
        deleteProfile(args[0]);
        print("Profile deleted.");
        break;
      }
      case "regquery": {
        if (!isAdmin) break;
        if (!args[0]) {
          print("regquery: usage: regquery <registry key>");
          break;
        }
        const result = await window.anchoran?.regQuery(line.slice(line.indexOf(" ") + 1));
        if (!result) print("regquery: not available outside the Anchoran desktop app.");
        else print(result.success ? result.output ?? "" : `regquery: ${result.error}`);
        break;
      }
      case "du": {
        if (!isAdmin) break;
        if (!args[0]) {
          print("du: usage: du <folder>");
          break;
        }
        const target = resolvePath(cwd, args[0]);
        const sizes = await window.anchoran?.getFolderSizes([{ label: args[0], path: target }]);
        if (!sizes) print("du: not available outside the Anchoran desktop app.");
        else print(formatBytes(sizes[0].size));
        break;
      }
      case "netcheck": {
        if (!isAdmin) break;
        print(navigator.onLine ? "Online." : "Offline.");
        break;
      }
      case "ping": {
        if (!isAdmin) break;
        if (!args[0]) {
          print("ping: usage: ping <host>");
          break;
        }
        print(`Pinging ${args[0]}…`);
        const result = await window.anchoran?.pingHost(args[0]);
        if (!result) print("ping: not available outside the Anchoran desktop app.");
        else print(result.output.trim() || "ping: no response.");
        break;
      }
      case "myip": {
        if (!isAdmin) break;
        try {
          const res = await fetch("https://api.ipify.org?format=json");
          const data = await res.json();
          print(data.ip ?? "myip: couldn't determine your IP.");
        } catch {
          print("myip: couldn't reach the lookup service.");
        }
        break;
      }
      case "listwindows": {
        if (!isAdmin) break;
        print(windows.map((w) => `${w.windowId}  ${w.title}${w.isMinimized ? " (minimized)" : ""}`).join("\n") || "No windows open.");
        break;
      }
      case "closewindow": {
        if (!isAdmin) break;
        if (!args[0]) {
          print("closewindow: usage: closewindow <window id> — see \"listwindows\"");
          break;
        }
        if (!windows.some((w) => w.windowId === args[0])) {
          print(`closewindow: no window with id "${args[0]}".`);
          break;
        }
        closeWindow(args[0]);
        print("Closed.");
        break;
      }
      case "resetlayout": {
        if (!isAdmin) break;
        useWindowStore.getState().resetWindowLayout();
        print("Window layout reset — apps will reopen at their default position.");
        break;
      }
      case "restartexplorer": {
        if (!isAdmin) break;
        const result = await window.anchoran?.restartExplorer();
        if (!result) print("restartexplorer: not available outside the Anchoran desktop app.");
        else print(result.success ? "Windows Explorer restarted." : `restartexplorer: ${result.error}`);
        break;
      }
      case "killexplorer": {
        if (!isAdmin) break;
        print('killexplorer: not implemented on its own — it would leave the real desktop with no taskbar/icons until something restarts it. Use "restartexplorer" instead.');
        break;
      }
      case "format":
      case "deleteallfiles": {
        if (!isAdmin) break;
        print(`${cmd}: refused. This could destroy real files with no way back, and there's no way to verify a confirmation typed here is really you. Not implemented, on purpose.`);
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
    <div
      className="terminal-root"
      data-admin={isAdmin}
      onClick={() => {
        // Re-focusing the input on every click made it steal focus
        // back the instant a text selection drag ended, so Ctrl+C
        // always copied the (empty) input instead of the output text
        // the user just selected. Only steal focus back when nothing
        // is actually selected — a plain click to "come back to
        // typing" still works exactly as before.
        if (window.getSelection()?.toString()) return;
        inputRef.current?.focus();
      }}
    >
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
              if (input.trim()) {
                commandHistory.current.push(input);
                if (commandHistory.current.length > 200) commandHistory.current.shift();
                persistSet("config", "terminalHistory", commandHistory.current);
              }
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
