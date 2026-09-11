import { useRef, useState } from "react";
import { useFsStore, ROOT_ID } from "@/filesystem/fs";
import { useWindowStore } from "@/windowmanager/windowStore";
import { ANCHORAN_VERSION } from "@/core/version";
import "@/applications/apps.css";

interface HistoryEntry {
  id: number;
  text: string;
}

let entryId = 0;

export function TerminalApp() {
  const [history, setHistory] = useState<HistoryEntry[]>([
    { id: entryId++, text: "Anchoran OS Terminal. Type \"help\" to get started." },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState(ROOT_ID);
  const inputRef = useRef<HTMLInputElement>(null);

  const nodes = useFsStore((s) => s.nodes);
  const childrenOf = useFsStore((s) => s.childrenOf);
  const getPath = useFsStore((s) => s.getPath);
  const createFolder = useFsStore((s) => s.createFolder);
  const createFile = useFsStore((s) => s.createFile);
  const openApp = useWindowStore((s) => s.openApp);

  function print(text: string) {
    setHistory((h) => [...h, { id: entryId++, text }]);
  }

  function pathString(id: string) {
    return "/" + getPath(id).map((n) => n.name).join("/");
  }

  function run(raw: string) {
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
        print(pathString(cwd));
        break;
      case "ls": {
        const items = childrenOf(cwd);
        print(items.length ? items.map((n) => (n.type === "folder" ? `${n.name}/` : n.name)).join("  ") : "");
        break;
      }
      case "cd": {
        if (!args[0] || args[0] === "~") {
          setCwd(ROOT_ID);
          break;
        }
        if (args[0] === "..") {
          const path = getPath(cwd);
          if (path.length > 1) setCwd(path[path.length - 2].id);
          break;
        }
        const target = childrenOf(cwd).find((n) => n.name === args[0] && n.type === "folder");
        if (target) setCwd(target.id);
        else print(`cd: no such directory: ${args[0]}`);
        break;
      }
      case "mkdir":
        if (!args[0]) print("mkdir: missing folder name");
        else createFolder(cwd, args[0]);
        break;
      case "touch":
        if (!args[0]) print("touch: missing file name");
        else createFile(cwd, args[0]);
        break;
      case "cat": {
        const file = childrenOf(cwd).find((n) => n.name === args[0] && n.type === "file");
        if (file) print(file.content || "");
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
          print("Anchoran is up to date.");
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
              run(input);
              setInput("");
            }
          }}
        />
      </div>
    </div>
  );
}
