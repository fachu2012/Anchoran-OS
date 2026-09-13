import { useState } from "react";
import { Icon } from "@/components/Icon";
import { TerminalConsole } from "./TerminalConsole";
import "./terminaltabs.css";

interface Tab {
  id: number;
}

let tabCounter = 0;
function newTab(): Tab {
  tabCounter += 1;
  return { id: tabCounter };
}

/**
 * Multiple independent shells in one Terminal window — each tab is its
 * own full TerminalConsole instance (own cwd, own scrollback, own
 * in-progress input line), kept mounted but hidden behind the others
 * rather than unmounted on switch, so backgrounding a tab never loses
 * what was running in it. Command history/aliases/env vars are still
 * shared across tabs (they're persisted globally), matching how a
 * real terminal's history works across its own tabs too.
 */
export function TerminalTabs({
  admin,
  windowId,
  greeting,
}: {
  admin: boolean;
  windowId?: string;
  greeting?: string;
}) {
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab()]);
  const [activeId, setActiveId] = useState(tabs[0].id);

  function addTab() {
    const tab = newTab();
    setTabs((t) => [...t, tab]);
    setActiveId(tab.id);
  }

  function closeTab(id: number) {
    setTabs((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((t) => t.id !== id);
      if (id === activeId) setActiveId(next[next.length - 1].id);
      return next;
    });
  }

  return (
    <div className="terminal-tabs-root">
      {tabs.length > 1 && (
        <div className="terminal-tabs-bar">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              className="terminal-tab"
              data-active={t.id === activeId}
              onClick={() => setActiveId(t.id)}
            >
              Shell {i + 1}
              <span
                className="terminal-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
                }}
              >
                <Icon name="close" size={11} />
              </span>
            </button>
          ))}
          <button className="terminal-tab-add" onClick={addTab} aria-label="New shell tab">
            <Icon name="plus" size={12} />
          </button>
        </div>
      )}
      {tabs.length === 1 && (
        <button className="terminal-tab-add-solo" onClick={addTab} aria-label="New shell tab" title="New shell tab">
          <Icon name="plus" size={12} />
        </button>
      )}
      {tabs.map((t) => (
        <div key={t.id} className="terminal-tab-content" style={{ display: t.id === activeId ? "flex" : "none" }}>
          <TerminalConsole admin={admin} windowId={windowId} greeting={greeting} />
        </div>
      ))}
    </div>
  );
}
