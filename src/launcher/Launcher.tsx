import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { IconTile } from "@/components/IconTile";
import { APP_LIST } from "@/applications/registry";
import type { AppDefinition, AppId } from "@/core/types";
import { useWindowStore } from "@/windowmanager/windowStore";
import { useTaskbarStore } from "@/desktop/taskbarStore";
import { useDesktopIconsStore } from "@/desktop/desktopIconsStore";
import { useInstalledAppsStore, isProtectedApp } from "@/applications/installedAppsStore";
import { ContextMenu, type ContextMenuEntry } from "@/desktop/ContextMenu";
import { AdminPinPrompt } from "@/core/AdminPinPrompt";
import { useAppUsageStore } from "@/core/appUsageStore";
import { useBrowserStore } from "@/applications/browser/browserStore";
import { persistGet, persistSet } from "@/core/persist";
import { useShortcutsStore } from "@/desktop/shortcutsStore";
import "./launcher.css";

// Mirrors Settings.tsx's SECTIONS — kept here as a plain list rather
// than deep-linking into a specific tab (Settings has no "open to this
// section" entry point yet), so a match just opens Settings and the
// user picks the tab themselves, one click in.
const SETTINGS_SECTIONS = [
  "Appearance", "Personalization", "Display", "Sound", "Network", "Notifications",
  "Users", "Privacy", "System", "Shortcuts", "System Mode", "Updater",
];

// Individual, specific settings a query might name — "dark mode",
// "wallpaper" — mapped to the section that actually holds them, so
// searching for the setting itself works, not just the section's own
// name (which SETTINGS_SECTIONS above already covers).
const SETTING_KEYWORDS: Record<string, string> = {
  "dark mode": "Appearance",
  "light mode": "Appearance",
  theme: "Appearance",
  accent: "Appearance",
  wallpaper: "Personalization",
  background: "Personalization",
  username: "Personalization",
  avatar: "Personalization",
  resolution: "Display",
  scale: "Display",
  brightness: "Display",
  volume: "Sound",
  mute: "Sound",
  wifi: "Network",
  "do not disturb": "Notifications",
  dnd: "Notifications",
  pin: "Users",
  admin: "Users",
  profile: "Users",
  "clipboard auto-clear": "Privacy",
  encryption: "Privacy",
  reset: "Privacy",
  backup: "Privacy",
  "storage used": "System",
  diagnostics: "System",
  update: "Updater",
  changelog: "Updater",
};

/** Apps that can be opened already-elevated via a right-click "Run as Administrator". */
const ADMIN_CAPABLE_APPS = new Set<AppId>(["terminal"]);

const JUMP_LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

function letterFor(title: string): string {
  const c = title.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

/**
 * A tiny, dependency-free arithmetic evaluator for the Launcher's
 * inline calculator — deliberately not `eval`/`Function`, just a
 * standard recursive-descent parser over +, -, *, /, parentheses and
 * decimals, so a query like "12 * (4 + 1)" resolves without shelling
 * out to a real expression engine for something this small.
 */
function evalArithmetic(input: string): number | null {
  const src = input.replace(/\s+/g, "");
  if (!/^[0-9.+\-*/()]+$/.test(src) || !/\d/.test(src)) return null;
  let i = 0;
  function peek() {
    return src[i];
  }
  function parseNumber(): number {
    const start = i;
    while (i < src.length && /[0-9.]/.test(src[i])) i++;
    if (i === start) throw new Error("expected number");
    return parseFloat(src.slice(start, i));
  }
  function parseFactor(): number {
    if (peek() === "(") {
      i++;
      const v = parseExpr();
      if (peek() !== ")") throw new Error("expected )");
      i++;
      return v;
    }
    if (peek() === "-") {
      i++;
      return -parseFactor();
    }
    return parseNumber();
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = src[i++];
      const rhs = parseFactor();
      v = op === "*" ? v * rhs : v / rhs;
    }
    return v;
  }
  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const rhs = parseTerm();
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  try {
    const result = parseExpr();
    if (i !== src.length || !Number.isFinite(result)) return null;
    return Math.round(result * 1e10) / 1e10;
  } catch {
    return null;
  }
}

interface FileResult {
  name: string;
  path: string;
  isDirectory: boolean;
}

async function searchFiles(query: string): Promise<FileResult[]> {
  if (!window.anchoran || query.length < 2) return [];
  const folders = await window.anchoran.fsSpecialFolders();
  const roots = [folders.desktop, folders.documents, folders.downloads, folders.pictures];
  const results: FileResult[] = [];
  const lowerQuery = query.toLowerCase();

  async function scan(dir: string, depth: number) {
    if (results.length >= 20 || depth > 3) return;
    const result = await window.anchoran!.fsListDir(dir);
    if ("error" in result) return;
    for (const entry of result.entries) {
      if (results.length >= 20) return;
      if (entry.name.toLowerCase().includes(lowerQuery)) {
        results.push({ name: entry.name, path: entry.path, isDirectory: entry.isDirectory });
      }
      if (entry.isDirectory) await scan(entry.path, depth + 1);
    }
  }

  for (const root of roots) {
    if (results.length >= 20) break;
    await scan(root, 0);
  }
  return results;
}

export function Launcher({
  onClose,
  onPower,
  onLock,
  onSleep,
  onRestart,
  onShutDown,
}: {
  onClose: () => void;
  onPower: () => void;
  onLock: () => void;
  onSleep: () => void;
  onRestart: () => void;
  onShutDown: () => void;
}) {
  const [query, setQuery] = useState("");
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const openApp = useWindowStore((s) => s.openApp);
  const pinned = useTaskbarStore((s) => s.pinned);
  const pin = useTaskbarStore((s) => s.pin);
  const unpin = useTaskbarStore((s) => s.unpin);
  const desktopPinned = useDesktopIconsStore((s) => s.pinnedApps);
  const pinToDesktop = useDesktopIconsStore((s) => s.pinApp);
  const unpinFromDesktop = useDesktopIconsStore((s) => s.unpinApp);
  const installed = useInstalledAppsStore((s) => s.installed);
  const uninstall = useInstalledAppsStore((s) => s.uninstall);
  const addShortcut = useShortcutsStore((s) => s.addShortcut);
  const recordUsage = useAppUsageStore((s) => s.record);
  const topApps = useAppUsageStore((s) => s.topApps);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  useEffect(() => {
    persistGet<string[]>("config", "launcherSearchHistory", []).then(setSearchHistory);
  }, []);
  function recordSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    const next = [trimmed, ...searchHistory.filter((s) => s !== trimmed)].slice(0, 8);
    setSearchHistory(next);
    persistSet("config", "launcherSearchHistory", next);
  }

  const [menu, setMenu] = useState<{ x: number; y: number; app: AppDefinition } | null>(null);
  const [adminPinPrompt, setAdminPinPrompt] = useState<{ mode: "runAsAdmin" } | null>(null);
  const [letterJumpOpen, setLetterJumpOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // The Launcher is a list of apps you can actually open — like any
  // real OS, that means installed apps only. Anchoran Webstore is
  // where you browse and install the rest. Sorted alphabetically once
  // here, so both the plain search results and the "browse all,
  // grouped by letter" view (see JUMP_LETTERS) share the same order.
  const sortedApps = useMemo(
    () =>
      APP_LIST.filter((a) => installed.has(a.id) && !a.hiddenFromLauncher).sort((a, b) =>
        a.title.localeCompare(b.title)
      ),
    [installed]
  );

  // Apps flagged hiddenFromLauncher (e.g. Anchover, the winver-style
  // build-info screen) are left out of sortedApps entirely — never in
  // "browse all" or the letter-jump list — but can still be found here,
  // and only by typing their exact full title, same as winver isn't
  // pinned anywhere and only turns up if you type its exact name.
  const allInstalledApps = useMemo(() => APP_LIST.filter((a) => installed.has(a.id)), [installed]);
  const appResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedApps;
    return allInstalledApps.filter((a) =>
      a.hiddenFromLauncher ? a.title.toLowerCase() === q : a.title.toLowerCase().includes(q)
    );
  }, [sortedApps, allInstalledApps, query]);

  const groupedApps = useMemo(() => {
    const groups = new Map<string, AppDefinition[]>();
    for (const app of sortedApps) {
      const letter = letterFor(app.title);
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter)!.push(app);
    }
    return groups;
  }, [sortedApps]);

  const browserHistory = useBrowserStore((s) => s.history);
  const browserResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !installed.has("browser")) return [];
    const seen = new Set<string>();
    return browserHistory
      .filter((h) => !seen.has(h.url) && (h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q)) && (seen.add(h.url), true))
      .slice(0, 5);
  }, [browserHistory, query, installed]);

  const settingResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const bySection = SETTINGS_SECTIONS.filter((s) => s.toLowerCase().includes(q));
    const byKeyword = Object.entries(SETTING_KEYWORDS)
      .filter(([keyword]) => keyword.includes(q))
      .map(([keyword, section]) => `${keyword} (in ${section})`);
    return [...bySection, ...byKeyword];
  }, [query]);

  // Real files are read from disk, so this is debounced rather than
  // searched on every keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFileResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const files = await searchFiles(q);
      if (!cancelled) setFileResults(files);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // While the letter-jump overlay is open, Escape closes just the
  // overlay instead of the whole Launcher.
  useEffect(() => {
    if (!letterJumpOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setLetterJumpOpen(false);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [letterJumpOpen]);

  function launch(appId: AppId) {
    recordUsage(appId);
    openApp(appId);
    onClose();
  }

  function openSettingSection() {
    openApp("settings");
    onClose();
  }

  async function openFileResult(file: FileResult) {
    if (file.isDirectory) {
      openApp("files");
      onClose();
      return;
    }
    const result = await window.anchoran!.fsOpenPath(file.path);
    if (result.success) onClose();
  }

  function scrollToLetter(letter: string) {
    sectionRefs.current.get(letter)?.scrollIntoView({ block: "start" });
    setLetterJumpOpen(false);
  }

  function contextItemsFor(app: AppDefinition): ContextMenuEntry[] {
    const isPinned = pinned.includes(app.id);
    const isOnDesktop = desktopPinned.includes(app.id);
    const items: ContextMenuEntry[] = [
      { label: "Open", onSelect: () => launch(app.id) },
      isPinned
        ? { label: "Unpin from taskbar", onSelect: () => unpin(app.id) }
        : { label: "Pin to taskbar", onSelect: () => pin(app.id) },
      isOnDesktop
        ? { label: "Remove from desktop", onSelect: () => unpinFromDesktop(app.id) }
        : { label: "Add to desktop", onSelect: () => pinToDesktop(app.id) },
    ];
    if (ADMIN_CAPABLE_APPS.has(app.id)) {
      items.push({ separator: true });
      items.push({ label: "Run as Administrator", icon: "lock", onSelect: () => setAdminPinPrompt({ mode: "runAsAdmin" }) });
      items.push({
        label: "Pin Administrator shortcut to Desktop",
        onSelect: () =>
          addShortcut({ appId: app.id, title: `${app.title} (Administrator)`, startAdmin: true }),
      });
    }
    if (!isProtectedApp(app.id)) {
      items.push({ separator: true });
      items.push({ label: "Uninstall", danger: true, onSelect: () => uninstall(app.id) });
    }
    return items;
  }

  function AppRow({ app, showHint }: { app: AppDefinition; showHint: boolean }) {
    return (
      <div
        className="launcher-item"
        data-active={showHint}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY, app });
        }}
      >
        <button className="launcher-item-main" onClick={() => launch(app.id)}>
          <IconTile name={app.icon as IconName} size={34} />
          {app.title}
          {showHint && <span className="launcher-item-hint">↵</span>}
        </button>
      </div>
    );
  }

  const hasQuery = query.trim().length > 0;
  const calcResult = hasQuery ? evalArithmetic(query) : null;

  const frequentApps = useMemo(() => {
    const installedSet = installed;
    return topApps(6)
      .filter((id) => installedSet.has(id))
      .map((id) => sortedApps.find((a) => a.id === id))
      .filter((a): a is AppDefinition => Boolean(a));
  }, [topApps, installed, sortedApps]);

  function openBrowserResult(url: string) {
    openApp("browser", { openPath: url });
    onClose();
  }

  function signOut() {
    useWindowStore.getState().closeAllWindows();
    // Guest is a single permanent profile — it stays in the list and
    // resets itself the next time it's entered, nothing to clean up here.
    onLock();
  }

  // #48 — a visible "system commands" category, findable from the
  // Launcher the same way Windows' own Start menu surfaces "shut
  // down" as a search result, not only as a menu you have to open
  // first.
  const SYSTEM_COMMANDS: { label: string; icon: IconName; run: () => void }[] = [
    { label: "Lock", icon: "lock", run: () => (onClose(), onLock()) },
    { label: "Sign out", icon: "userSwitch", run: () => (onClose(), signOut()) },
    { label: "Sleep", icon: "minimize", run: () => (onClose(), onSleep()) },
    { label: "Restart Anchoran", icon: "restart", run: () => (onClose(), onRestart()) },
    { label: "Shut down Anchoran", icon: "power", run: () => (onClose(), onShutDown()) },
    { label: "Power menu", icon: "power", run: () => (onClose(), onPower()) },
  ];
  const systemCommandResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SYSTEM_COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Full keyboard-only mode: every visible, actionable row — the
  // calculator result, apps, settings, files, browser history — in
  // the exact order they're rendered below, so Up/Down/Enter reaches
  // any of them, not just the first app match.
  const keyboardEntries = useMemo(() => {
    const entries: (() => void)[] = [];
    if (calcResult !== null) entries.push(() => navigator.clipboard?.writeText(String(calcResult)).catch(() => {}));
    if (!hasQuery) {
      frequentApps.forEach((a) => entries.push(() => launch(a.id)));
      for (const letter of JUMP_LETTERS) {
        const apps = groupedApps.get(letter);
        if (!apps) continue;
        apps.forEach((a) => entries.push(() => launch(a.id)));
      }
    } else {
      appResults.forEach((a) => entries.push(() => launch(a.id)));
      settingResults.forEach(() => entries.push(() => openSettingSection()));
      fileResults.forEach((f) => entries.push(() => openFileResult(f)));
      browserResults.forEach((h) => entries.push(() => openBrowserResult(h.url)));
      systemCommandResults.forEach((c) => entries.push(() => c.run()));
    }
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasQuery,
    calcResult,
    frequentApps,
    groupedApps,
    appResults,
    settingResults,
    fileResults,
    browserResults,
    systemCommandResults,
  ]);

  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);
  useEffect(() => {
    if (activeIndex >= keyboardEntries.length) setActiveIndex(Math.max(0, keyboardEntries.length - 1));
  }, [keyboardEntries.length, activeIndex]);
  useEffect(() => {
    resultsRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Assigns each rendered row its position in keyboardEntries, in the
  // same top-to-bottom order the JSX below renders them — reset once
  // per render via this counter rather than tracked per-section, since
  // sections render in a fixed, known sequence.
  let rowCursor = -1;
  function nextRowIsActive(): boolean {
    rowCursor += 1;
    return rowCursor === activeIndex;
  }

  return (
    <div className="launcher-backdrop" onClick={onClose}>
      <div
        className="launcher-panel"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <div className="launcher-search">
          <Icon name="search" size={18} />
          <input
            autoFocus
            placeholder="Search apps, files and settings…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLetterJumpOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, keyboardEntries.length - 1));
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
                return;
              }
              if (e.key === "Enter") {
                if (hasQuery) recordSearch(query);
                const entry = keyboardEntries[activeIndex];
                if (entry) entry();
                else if (calcResult !== null) navigator.clipboard?.writeText(String(calcResult)).catch(() => {});
              }
              if (e.key === "Escape") onClose();
            }}
          />
        </div>
        <div className="launcher-results" ref={resultsRef}>
          {calcResult !== null && (
            <div className="launcher-item" data-active={nextRowIsActive()}>
              <button
                className="launcher-item-main"
                onClick={() => navigator.clipboard?.writeText(String(calcResult)).catch(() => {})}
              >
                <IconTile name="calculator" size={34} />
                {query.trim()} = {calcResult}
                <span className="launcher-item-hint">copy</span>
              </button>
            </div>
          )}
          {!hasQuery ? (
            <>
              {searchHistory.length > 0 && (
                <div className="launcher-search-history">
                  {searchHistory.map((s) => (
                    <button key={s} className="launcher-search-history-chip" onClick={() => setQuery(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {frequentApps.length > 0 && (
                <>
                  <div className="launcher-section-label">Frequently used</div>
                  {frequentApps.map((app) => (
                    <AppRow key={`frequent-${app.id}`} app={app} showHint={nextRowIsActive()} />
                  ))}
                </>
              )}
              {JUMP_LETTERS.filter((l) => groupedApps.has(l)).map((letter) => (
                <div
                  key={letter}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(letter, el);
                    else sectionRefs.current.delete(letter);
                  }}
                >
                  <button className="launcher-letter-header" onClick={() => setLetterJumpOpen((v) => !v)}>
                    {letter}
                  </button>
                  {groupedApps.get(letter)!.map((app) => (
                    <AppRow key={app.id} app={app} showHint={nextRowIsActive()} />
                  ))}
                </div>
              ))}
            </>
          ) : (
            appResults.map((app) => <AppRow key={app.id} app={app} showHint={nextRowIsActive()} />)
          )}

          {hasQuery && settingResults.length > 0 && (
            <>
              <div className="launcher-section-label">Settings</div>
              {settingResults.map((s) => (
                <div key={s} className="launcher-item" data-active={nextRowIsActive()}>
                  <button className="launcher-item-main" onClick={openSettingSection}>
                    <IconTile name="settings" size={34} />
                    {s}
                  </button>
                </div>
              ))}
            </>
          )}

          {hasQuery && fileResults.length > 0 && (
            <>
              <div className="launcher-section-label">Files</div>
              {fileResults.map((f) => (
                <div key={f.path} className="launcher-item" data-active={nextRowIsActive()}>
                  <button className="launcher-item-main" onClick={() => openFileResult(f)}>
                    <IconTile name={f.isDirectory ? "folder" : "file"} size={34} />
                    {f.name}
                  </button>
                </div>
              ))}
            </>
          )}

          {hasQuery && browserResults.length > 0 && (
            <>
              <div className="launcher-section-label">Browser history</div>
              {browserResults.map((h) => (
                <div key={h.url} className="launcher-item" data-active={nextRowIsActive()}>
                  <button className="launcher-item-main" onClick={() => openBrowserResult(h.url)}>
                    <IconTile name="browser" size={34} />
                    {h.title || h.url}
                  </button>
                </div>
              ))}
            </>
          )}

          {hasQuery && systemCommandResults.length > 0 && (
            <>
              <div className="launcher-section-label">System</div>
              {systemCommandResults.map((c) => (
                <div key={c.label} className="launcher-item" data-active={nextRowIsActive()}>
                  <button className="launcher-item-main" onClick={c.run}>
                    <IconTile name={c.icon} size={34} />
                    {c.label}
                  </button>
                </div>
              ))}
            </>
          )}

          {hasQuery &&
            appResults.length === 0 &&
            settingResults.length === 0 &&
            fileResults.length === 0 &&
            browserResults.length === 0 &&
            systemCommandResults.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: "var(--anchoran-text-secondary)" }}>No results.</div>
            )}

          {letterJumpOpen && (
            <div className="launcher-jump-overlay">
              {JUMP_LETTERS.map((letter) => (
                <button
                  key={letter}
                  className="launcher-jump-letter"
                  disabled={!groupedApps.has(letter)}
                  onClick={() => scrollToLetter(letter)}
                >
                  {letter}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="launcher-footer">
          <button
            onClick={() => {
              onClose();
              openApp("settings");
            }}
          >
            <Icon name="settings" size={14} /> Settings
          </button>
          <button
            onClick={() => {
              onClose();
              onPower();
            }}
          >
            <Icon name="power" size={14} /> Power
          </button>
        </div>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={contextItemsFor(menu.app)}
          onClose={() => setMenu(null)}
        />
      )}

      {adminPinPrompt && (
        <AdminPinPrompt
          onCancel={() => setAdminPinPrompt(null)}
          onSuccess={() => {
            setAdminPinPrompt(null);
            onClose();
            openApp("terminal", { startAdmin: true });
          }}
        />
      )}
    </div>
  );
}
