import { useEffect, useRef, useState } from "react";
import { useWindowStore } from "@/windowmanager/windowStore";
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

export function TerminalApp() {
  const [history, setHistory] = useState<HistoryEntry[]>([
    { id: entryId++, text: "Anchoran OS Terminal. Type \"help\" to get started." },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commandHistory = useRef<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);

  const openApp = useWindowStore((s) => s.openApp);
  const awaitingUpdate = useRef(false);

  useEffect(() => {
    window.anchoran?.fsSpecialFolders().then((folders) => setCwd(folders.home));
  }, []);

  function print(text: string) {
    setHistory((h) => [...h, { id: entryId++, text }]);
  }

  // Only prints update status for an `anchoran update` this exact
  // terminal window ran — other open Terminal windows stay quiet, even
  // though the update check itself is process-wide.
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

  async function run(raw: string) {
    const line = raw.trim();
    print(`user@anchoran:~$ ${raw}`);
    if (!line) return;

    const [cmd, ...args] = line.split(/\s+/);
    const rest = args.join(" ");

    switch (cmd) {
      case "help":
        print(
          [
            "Available commands:",
            "  help, clear, about, system, date, echo, pwd, ls, cd, mkdir, touch, cat",
            "  anchoran system | anchoran version | anchoran settings | anchoran update",
          ].join("\n")
        );
        break;
      case "clear":
        setHistory([]);
        break;
      case "about":
        print(`Anchoran OS ${ANCHORAN_VERSION} — a minimal, focused desktop environment.`);
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
        const target = args[0] === ".." ? parentPath(cwd) : `${cwd}\\${args[0]}`;
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
        const result = await window.anchoran?.fsReadTextFile(`${cwd}\\${args[0]}`);
        if (result && "content" in result) print(result.content);
        else print(`cat: no such file: ${args[0]}`);
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
      default:
        print(`${cmd}: command not found`);
    }
  }

  return (
    <div className="terminal-root" onClick={() => inputRef.current?.focus()}>
      {history.map((entry) => (
        <div key={entry.id} className="terminal-line">
          {entry.text}
        </div>
      ))}
      <div className="terminal-prompt-row">
        <span className="terminal-prompt-label">user@anchoran:~$</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={input}
          autoFocus
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
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
              const nextCursor =
                historyCursor === null
                  ? commandHistory.current.length - 1
                  : Math.max(0, historyCursor - 1);
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
