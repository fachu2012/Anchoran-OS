import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { useWebviewContextMenu } from "@/core/useWebviewContextMenu";
import { useWebviewVolume } from "@/core/useWebviewVolume";
import { useNotificationStore } from "@/notifications/notificationStore";
import { ContextMenu, type ContextMenuEntry } from "@/desktop/ContextMenu";
import { useBrowserStore, type Bookmark } from "./browserStore";
import { useShortcutsStore } from "@/desktop/shortcutsStore";
import { AnchoranFilePicker } from "@/core/AnchoranFilePicker";
import "@/applications/apps.css";
import "./browser.css";

/**
 * A real browser embedded inside Anchoran itself — Electron's
 * `<webview>` runs the actual Chromium engine (the same rendering core
 * Google Chrome is built on), as its own separate guest process, so
 * real sites load normally. It is deliberately NOT labeled "Google
 * Chrome" or any other real product name: it's genuinely Chromium
 * underneath, but it isn't the Google-branded product with its account
 * sync, extensions, or updates, and calling it that would be
 * misleading. It's also deliberately kept inside Anchoran's own
 * window rather than launching a separate real Chrome process outside
 * it — the whole point is that it's part of the OS shell, not a
 * detour out of it.
 */

interface WebviewTag extends HTMLElement {
  src: string;
  getURL: () => string;
  getTitle: () => string;
  loadURL: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  reload: () => void;
  stop: () => void;
  isLoading: () => boolean;
  setZoomFactor: (factor: number) => void;
  getZoomFactor: () => number;
  findInPage: (text: string, options?: { forward?: boolean; findNext?: boolean }) => void;
  stopFindInPage: (action: "clearSelection" | "keepSelection") => void;
  print: () => void;
  printToPDF: (options: Record<string, unknown>) => Promise<Uint8Array>;
  insertCSS: (css: string) => Promise<string>;
  removeInsertedCSS: (key: string) => Promise<void>;
  getWebContentsId: () => number;
}

interface FavEvent extends Event {
  favicons: string[];
}
interface TitleEvent extends Event {
  title: string;
}
interface NavEvent extends Event {
  url: string;
}
interface NewWindowEvent extends Event {
  url: string;
}
interface FoundEvent extends Event {
  result: { matches: number; activeMatchOrdinal: number };
}

const NEW_TAB_URL = "anchoran://newtab";
const HOME_URL = "https://www.google.com";
const PERSISTENT_PARTITION = "persist:anchoran-browser";

interface Tab {
  id: string;
  url: string;
  loadUrl: string; // what to actually navigate the webview to next (may differ from url briefly)
  title: string;
  favicon: string | null;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  incognito: boolean;
  darkMode: boolean;
  zoom: number;
  pinned: boolean;
  /** Which tab group this tab belongs to, or null — see TAB_GROUP_COLORS below. */
  groupId: string | null;
  /** Last time this tab was the active one — drives background-tab discarding, see DISCARD_AFTER_MS below. */
  lastActiveAt: number;
}

// A background tab left untouched this long unmounts its <webview>
// entirely (a real Chromium renderer process, real memory) rather
// than keeping every ever-opened tab alive forever — the same "tab
// discarding" real browsers do to hold idle memory down. Reactivating
// a discarded tab just remounts it fresh from its own URL; pinned
// tabs are exempt, matching how pinned tabs behave in real browsers
// too.
const DISCARD_AFTER_MS = 15 * 60_000;

const TAB_GROUP_COLORS = ["#E5484D", "#F76B15", "#F5D90A", "#30A46C", "#3E7BFA", "#8E4EC6"];

interface TabGroup {
  id: string;
  name: string;
  color: string;
}

let tabCounter = 0;
function newTab(url = NEW_TAB_URL, incognito = false): Tab {
  return {
    id: `tab-${++tabCounter}`,
    url,
    loadUrl: url,
    title: url === NEW_TAB_URL ? "New Tab" : url,
    favicon: null,
    loading: false,
    canGoBack: false,
    canGoForward: false,
    incognito,
    darkMode: false,
    zoom: 1,
    pinned: false,
    groupId: null,
    lastActiveAt: Date.now(),
  };
}

/** Bare domain or search text -> a real URL; anything already URL-shaped is left as-is. */
function resolveInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return NEW_TAB_URL;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("anchoran://")) return trimmed;
  const looksLikeDomain = /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/i.test(trimmed) && !trimmed.includes(" ");
  if (looksLikeDomain) return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

function NewTabPage({ onGo }: { onGo: (url: string) => void }) {
  const [query, setQuery] = useState("");
  const bookmarks = useBrowserStore((s) => s.bookmarks);
  const [weather, setWeather] = useState<{ city: string; temp: number } | null>(null);

  useEffect(() => {
    (async () => {
      const city = await window.anchoran?.dataGet("weatherLastCity");
      if (!city || typeof city !== "string") return;
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
        const geo = await geoRes.json();
        const place = geo.results?.[0];
        if (!place) return;
        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m`
        );
        const w = await wRes.json();
        setWeather({ city: place.name, temp: Math.round(w.current.temperature_2m) });
      } catch {
        // A missing weather widget on the new tab page isn't worth surfacing an error for.
      }
    })();
  }, []);

  return (
    <div className="browser-newtab">
      {weather && (
        <div className="browser-newtab-weather">
          <Icon name="weather" size={16} /> {weather.city} · {weather.temp}°C
        </div>
      )}
      <div className="browser-newtab-logo">Anchoran Browser</div>
      <input
        autoFocus
        className="browser-newtab-search"
        placeholder="Search the web or type a URL…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onGo(query)}
      />
      {bookmarks.length > 0 && (
        <div className="browser-newtab-bookmarks">
          {bookmarks.slice(0, 8).map((b) => (
            <button key={b.url} className="browser-newtab-bookmark" onClick={() => onGo(b.url)}>
              <Icon name="browser" size={14} />
              <span>{b.title || b.url}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Cosmetic filtering — hides common ad/promo containers via CSS the
// moment a page loads, on top of the network-level host blocking in
// electron/main.ts. This is the other half of a "robust" ad blocker:
// network blocking alone still leaves an empty gap where a blocked
// ad's iframe/div used to sit; this collapses it instead.
const AD_HIDE_SELECTOR = [
  '[id*="google_ads" i]', '[id*="banner-ad" i]', '[class*="banner-ad" i]',
  '[id^="div-gpt-ad"]', '[class*="adsbygoogle" i]', '[class*="ad-container" i]',
  '[class*="ad-slot" i]', '[class*="advert" i]', '[class^="ad-" i]',
  '[data-ad-slot]', '[data-ad-client]', 'ins.adsbygoogle',
  '[class*="sponsored" i]', '[id*="taboola" i]', '[id*="outbrain" i]',
].join(",");

function BrowserTabView({
  tab,
  active,
  trackerBlock,
  onUpdate,
  onNewTab,
  registerRef,
}: {
  tab: Tab;
  active: boolean;
  trackerBlock: boolean;
  onUpdate: (id: string, patch: Partial<Tab>) => void;
  onNewTab: (url: string) => void;
  registerRef: (id: string, el: HTMLElement | null) => void;
}) {
  const webviewRef = useRef<HTMLElement | null>(null);
  useWebviewContextMenu(webviewRef);
  useWebviewVolume("browser", webviewRef);

  useEffect(() => {
    const el = webviewRef.current as WebviewTag | null;
    if (!el) return;

    function onTitle(e: Event) {
      onUpdate(tab.id, { title: (e as TitleEvent).title });
    }
    function onFavicon(e: Event) {
      const list = (e as FavEvent).favicons;
      onUpdate(tab.id, { favicon: list?.[0] ?? null });
    }
    function onNav(e: Event) {
      const url = (e as NavEvent).url;
      onUpdate(tab.id, {
        url,
        canGoBack: (el as WebviewTag).canGoBack(),
        canGoForward: (el as WebviewTag).canGoForward(),
      });
    }
    function onStartLoading() {
      onUpdate(tab.id, { loading: true });
    }
    function onStopLoading() {
      onUpdate(tab.id, { loading: false });
    }
    function onNewWindow(e: Event) {
      onNewTab((e as NewWindowEvent).url);
    }
    function onDomReady() {
      if (tab.darkMode) {
        (el as WebviewTag)
          .insertCSS("html { filter: invert(1) hue-rotate(180deg); } img, video, picture { filter: invert(1) hue-rotate(180deg); }")
          .catch(() => {});
      }
      if (trackerBlock) {
        (el as WebviewTag).insertCSS(`${AD_HIDE_SELECTOR} { display: none !important; }`).catch(() => {});
      }
    }

    el.addEventListener("page-title-updated", onTitle);
    el.addEventListener("page-favicon-updated", onFavicon);
    el.addEventListener("did-navigate", onNav);
    el.addEventListener("did-navigate-in-page", onNav);
    el.addEventListener("did-start-loading", onStartLoading);
    el.addEventListener("did-stop-loading", onStopLoading);
    el.addEventListener("new-window", onNewWindow);
    el.addEventListener("dom-ready", onDomReady);
    return () => {
      el.removeEventListener("page-title-updated", onTitle);
      el.removeEventListener("page-favicon-updated", onFavicon);
      el.removeEventListener("did-navigate", onNav);
      el.removeEventListener("did-navigate-in-page", onNav);
      el.removeEventListener("did-start-loading", onStartLoading);
      el.removeEventListener("did-stop-loading", onStopLoading);
      el.removeEventListener("new-window", onNewWindow);
      el.removeEventListener("dom-ready", onDomReady);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, tab.darkMode, trackerBlock]);

  if (tab.loadUrl === NEW_TAB_URL) {
    return (
      <div className="browser-tab-view" style={{ display: active ? "flex" : "none" }}>
        <NewTabPage onGo={(input) => onUpdate(tab.id, { url: resolveInput(input), loadUrl: resolveInput(input) })} />
      </div>
    );
  }

  return (
    <div className="browser-tab-view" style={{ display: active ? "flex" : "none" }}>
      <webview
        ref={(el) => {
          webviewRef.current = el;
          registerRef(tab.id, el);
        }}
        src={tab.loadUrl}
        partition={tab.incognito ? `browser-incognito-${tab.id}` : PERSISTENT_PARTITION}
        allowpopups={true}
        style={{ width: "100%", height: "100%", display: "flex" }}
      />
    </div>
  );
}

export function BrowserApp({ openPath }: { openPath?: string } = {}) {
  // A URL handed in at open time (from the Launcher's browser-history
  // search results, or any future caller) opens straight to it instead
  // of the usual new-tab page.
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab(openPath || HOME_URL)]);
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [tabPreview, setTabPreview] = useState<{ id: string; dataUrl: string } | null>(null);
  const tabPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [readerContent, setReaderContent] = useState<{ title: string; paragraphs: string[] } | null>(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [translateMenuOpen, setTranslateMenuOpen] = useState(false);
  const [savePagePicker, setSavePagePicker] = useState(false);
  const [tabMenu, setTabMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [pageMenu, setPageMenu] = useState<{ x: number; y: number } | null>(null);
  const [activeId, setActiveId] = useState(tabs[0].id);

  // Tracks when each tab last became active (for background-tab
  // discarding below), and periodically re-renders so a long-idle
  // background tab's webview actually unmounts once it crosses
  // DISCARD_AFTER_MS, rather than only checking on the next unrelated
  // render.
  useEffect(() => {
    setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, lastActiveAt: Date.now() } : t)));
  }, [activeId]);
  const [, forceDiscardCheck] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceDiscardCheck((n) => n + 1), 60_000);
    return () => clearInterval(interval);
  }, []);
  const [addressInput, setAddressInput] = useState(HOME_URL);
  const [addressFocused, setAddressFocused] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findResult, setFindResult] = useState<{ matches: number; active: number } | null>(null);
  const [panel, setPanel] = useState<"history" | "bookmarks" | "downloads" | null>(null);
  const [downloads, setDownloads] = useState<
    { id: string; fileName: string; path: string; receivedBytes: number; totalBytes: number; state: string }[]
  >([]);
  const [trackerBlock, setTrackerBlock] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  useEffect(() => {
    if (!trackerBlock || !window.anchoran) return;
    const poll = () => window.anchoran!.getTrackerBlockCount().then(setBlockedCount);
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [trackerBlock]);
  const closedStack = useRef<Tab[]>([]);
  const webviewNodes = useRef<Map<string, WebviewTag>>(new Map());
  const pushNotification = useNotificationStore((s) => s.push);
  const { recordVisit, bookmarks, addBookmark, removeBookmark, isBookmarked, setBookmarkFolder, history, clearHistory, removeHistoryEntry } =
    useBrowserStore();

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  useEffect(() => {
    setAddressInput(active?.url === NEW_TAB_URL ? "" : active?.url ?? "");
  }, [active?.url, active?.id]);

  // Real page visits only — new tab page and incognito tabs stay out of history.
  useEffect(() => {
    if (!active || active.url === NEW_TAB_URL || active.incognito || active.loading) return;
    recordVisit(active.url, active.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.url, active?.loading]);

  useEffect(() => {
    window.anchoran?.onDownloadUpdate((record) => {
      setDownloads((d) => {
        const next = d.filter((x) => x.id !== record.id);
        return [record, ...next].slice(0, 50);
      });
      if (record.state === "completed") {
        pushNotification("Browser", `Downloaded ${record.fileName}.`);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function registerRef(id: string, el: HTMLElement | null) {
    if (el) webviewNodes.current.set(id, el as WebviewTag);
    else webviewNodes.current.delete(id);
  }

  function updateTab(id: string, patch: Partial<Tab>) {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function openTab(url: string, options?: { incognito?: boolean; background?: boolean }) {
    const t = newTab(url, options?.incognito ?? false);
    setTabs((prev) => [...prev, t]);
    if (!options?.background) setActiveId(t.id);
    return t.id;
  }

  // Browser is single-instance — reopening it with a new openPath (the
  // Launcher's browser-history search results, say) re-focuses the
  // existing window rather than remounting it, so the initial-tab
  // useState above only ever runs once. This is what actually
  // navigates for every open after the first.
  const lastOpenPath = useRef(openPath);
  useEffect(() => {
    if (openPath && openPath !== lastOpenPath.current) openTab(openPath);
    lastOpenPath.current = openPath;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPath]);

  function closeTab(id: string) {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0) return prev;
      const closing = prev[idx];
      if (!closing.incognito) closedStack.current.push(closing);
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const fresh = newTab();
        if (activeId === id) setActiveId(fresh.id);
        return [fresh];
      }
      if (activeId === id) {
        const fallback = next[Math.min(idx, next.length - 1)];
        setActiveId(fallback.id);
      }
      return next;
    });
  }

  function closeOthers(id: string) {
    setTabs((prev) => prev.filter((t) => t.id === id));
    setActiveId(id);
  }

  function closeToRight(id: string) {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      return prev.filter((_, i) => i <= idx);
    });
  }

  function duplicateTab(id: string) {
    const source = tabs.find((t) => t.id === id);
    if (source) openTab(source.url);
  }

  function togglePin(id: string) {
    setTabs((prev) => {
      const toggled = prev.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t));
      // Pinned tabs live at the front of the strip, in whatever order
      // they were pinned; unpinned ones keep their relative order too.
      const pinned = toggled.filter((t) => t.pinned);
      const rest = toggled.filter((t) => !t.pinned);
      return [...pinned, ...rest];
    });
  }

  function createGroup(tabId: string) {
    const existing = tabs.find((t) => t.id === tabId);
    if (!existing) return;
    const color = TAB_GROUP_COLORS[groups.length % TAB_GROUP_COLORS.length];
    const group: TabGroup = { id: `group-${Date.now()}`, name: `Group ${groups.length + 1}`, color };
    setGroups((prev) => [...prev, group]);
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, groupId: group.id } : t)));
  }

  function addToGroup(tabId: string, groupId: string) {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, groupId } : t)));
  }

  function removeFromGroup(tabId: string) {
    setTabs((prev) => {
      const next = prev.map((t) => (t.id === tabId ? { ...t, groupId: null } : t));
      // A group with no tabs left in it isn't worth keeping around.
      const stillUsed = new Set(next.filter((t) => t.groupId).map((t) => t.groupId));
      setGroups((g) => g.filter((grp) => stillUsed.has(grp.id)));
      return next;
    });
  }

  function closeGroup(groupId: string) {
    setTabs((prev) => prev.filter((t) => t.groupId !== groupId));
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  // A real visual thumbnail, not just the title — <webview>'s own
  // capturePage() runs entirely in the renderer, no IPC needed, so
  // grabbing a still of a background tab is cheap enough to do on
  // hover. Debounced so a quick mouse pass across the tab strip
  // doesn't fire a capture per tab.
  function scheduleTabPreview(tabId: string) {
    if (tabPreviewTimer.current) clearTimeout(tabPreviewTimer.current);
    tabPreviewTimer.current = setTimeout(async () => {
      const webview = webviewNodes.current.get(tabId) as (WebviewTag & { capturePage: () => Promise<{ toDataURL: () => string }> }) | undefined;
      if (!webview) return;
      try {
        const image = await webview.capturePage();
        setTabPreview({ id: tabId, dataUrl: image.toDataURL() });
      } catch {
        // A background/unmounted webview can't be captured — no preview, not an error worth surfacing.
      }
    }, 350);
  }

  function cancelTabPreview() {
    if (tabPreviewTimer.current) clearTimeout(tabPreviewTimer.current);
    setTabPreview(null);
  }

  // Reading mode: a simple, honest extraction — picks whichever
  // container has the most total paragraph text (the same signal real
  // readability heuristics lean on), then pulls its paragraphs out as
  // *plain text*, not HTML. That sidesteps needing an HTML sanitizer
  // for content coming out of an arbitrary web page, at the cost of
  // losing inline formatting/links — a real trade-off, not an
  // oversight.
  const READER_EXTRACT_SCRIPT = `(() => {
    const candidates = Array.from(document.querySelectorAll('article, main, [role="main"], .post, .article, #content, .content, body'));
    let best = document.body;
    let bestScore = -1;
    for (const el of candidates) {
      let score = 0;
      for (const p of el.querySelectorAll('p')) score += (p.innerText || '').length;
      if (score > bestScore) { bestScore = score; best = el; }
    }
    const paragraphs = Array.from(best.querySelectorAll('p'))
      .map((p) => (p.innerText || '').trim())
      .filter((t) => t.length > 40);
    return { title: document.title, paragraphs };
  })()`;

  async function openReaderMode() {
    const webview = webviewNodes.current.get(activeId) as (WebviewTag & { executeJavaScript: (code: string) => Promise<{ title: string; paragraphs: string[] }> }) | undefined;
    if (!webview) return;
    setReaderLoading(true);
    try {
      const result = await webview.executeJavaScript(READER_EXTRACT_SCRIPT);
      if (!result?.paragraphs?.length) {
        pushNotification("Browser", "Couldn't find readable article text on this page.");
      } else {
        setReaderContent(result);
      }
    } catch {
      pushNotification("Browser", "Reading mode isn't available on this page.");
    } finally {
      setReaderLoading(false);
    }
  }

  // Translation, honestly scoped: Anchoran has no translation engine
  // or paid API key of its own, so this opens Google's public
  // translate.google.com proxy for the current page — the same
  // no-API-key trick many browsers' own "quick translate" fallback
  // uses — in a new tab, rather than pretending to translate in place.
  function translatePage(targetLang: string) {
    if (!active || active.url === NEW_TAB_URL) return;
    setTranslateMenuOpen(false);
    openTab(`https://translate.google.com/translate?sl=auto&tl=${targetLang}&u=${encodeURIComponent(active.url)}`);
  }

  function reopenClosed() {
    const last = closedStack.current.pop();
    if (last) openTab(last.url);
  }

  function currentWebview(): WebviewTag | undefined {
    return webviewNodes.current.get(activeId);
  }

  function go(input: string) {
    const url = resolveInput(input);
    updateTab(activeId, { url, loadUrl: url });
  }

  function goBack() {
    currentWebview()?.goBack();
  }
  function goForward() {
    currentWebview()?.goForward();
  }
  function reload() {
    const wv = currentWebview();
    if (wv?.isLoading()) wv.stop();
    else wv?.reload();
  }

  function zoomBy(delta: number) {
    const wv = currentWebview();
    const nextZoom = Math.max(0.5, Math.min(2.5, active.zoom + delta));
    wv?.setZoomFactor(nextZoom);
    updateTab(activeId, { zoom: nextZoom });
  }
  function zoomReset() {
    currentWebview()?.setZoomFactor(1);
    updateTab(activeId, { zoom: 1 });
  }

  function toggleBookmark() {
    if (!active || active.url === NEW_TAB_URL) return;
    if (isBookmarked(active.url)) removeBookmark(active.url);
    else addBookmark(active.url, active.title);
  }

  function toggleDarkMode() {
    updateTab(activeId, { darkMode: !active.darkMode });
    // Re-apply immediately rather than waiting for the next navigation.
    const wv = currentWebview();
    if (wv && !active.darkMode) {
      wv.insertCSS("html { filter: invert(1) hue-rotate(180deg); } img, video, picture { filter: invert(1) hue-rotate(180deg); }").catch(() => {});
    }
  }

  function runFind(next?: boolean) {
    const wv = currentWebview();
    if (!wv || !findQuery.trim()) return;
    wv.findInPage(findQuery, { forward: true, findNext: next });
  }
  function closeFind() {
    currentWebview()?.stopFindInPage("clearSelection");
    setFindOpen(false);
    setFindQuery("");
    setFindResult(null);
  }

  useEffect(() => {
    const wv = currentWebview();
    if (!wv) return;
    function onFound(e: Event) {
      const r = (e as FoundEvent).result;
      setFindResult({ matches: r.matches, active: r.activeMatchOrdinal });
    }
    wv.addEventListener("found-in-page", onFound);
    return () => wv.removeEventListener("found-in-page", onFound);
  }, [activeId]);

  async function printPage() {
    currentWebview()?.print();
  }

  async function saveAsPdf() {
    const wv = currentWebview();
    if (!wv || !window.anchoran) return;
    try {
      const buffer = await wv.printToPDF({});
      // Spreading the whole array into String.fromCharCode at once can
      // blow the call stack on a large PDF — built up in chunks instead.
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const base64 = btoa(binary);
      const name = `${(active.title || "page").replace(/[\\/:*?"<>|]/g, "_")}.pdf`;
      const result = await window.anchoran.saveAndOpenFile(name, base64);
      pushNotification("Browser", result.success ? "Saved and opened as PDF." : result.error ?? "Couldn't save PDF.");
    } catch {
      pushNotification("Browser", "Couldn't save this page as a PDF.");
    }
  }

  function copyLink() {
    if (active?.url) navigator.clipboard?.writeText(active.url);
  }

  // "Save complete page" — the real Electron savePage API (HTML +
  // every referenced asset, into its own folder), distinct from the
  // full-page *screenshot* above: this saves the actual page, viewable
  // offline in a real browser, not just a picture of it.
  async function onSavePageComplete(result: { path: string } | { dir: string; name: string }) {
    setSavePagePicker(false);
    if (!("path" in result) || !window.anchoran || !active) return;
    const wv = webviewNodes.current.get(activeId) as (WebviewTag & { getWebContentsId: () => number }) | undefined;
    if (!wv) return;
    const fileName = `${(active.title || "page").replace(/[\\/:*?"<>|]/g, "_")}.html`;
    const saved = await window.anchoran.savePageComplete(wv.getWebContentsId(), result.path, fileName);
    pushNotification("Browser", saved.success ? `Page saved to ${saved.path}.` : saved.error ?? "Couldn't save this page.");
  }

  // Full-page screenshot: capturePage() (used for the tab hover
  // preview too) only grabs the visible viewport, so this scrolls
  // through the page in viewport-height steps, captures each step,
  // and stitches them onto one tall canvas — capped at 20 steps so an
  // effectively infinite-scroll page doesn't hang forever.
  async function captureFullPage() {
    const wv = webviewNodes.current.get(activeId) as
      | (WebviewTag & { executeJavaScript: (code: string) => Promise<unknown>; capturePage: () => Promise<{ toDataURL: () => string }> })
      | undefined;
    if (!wv || !active || !window.anchoran) return;
    try {
      const dims = (await wv.executeJavaScript(
        "({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportHeight: window.innerHeight, viewportWidth: window.innerWidth })"
      )) as { width: number; height: number; viewportHeight: number; viewportWidth: number };

      const MAX_STEPS = 20;
      const steps: { dataUrl: string; y: number }[] = [];
      let y = 0;
      while (y < dims.height && steps.length < MAX_STEPS) {
        await wv.executeJavaScript(`window.scrollTo(0, ${y})`);
        await new Promise((r) => setTimeout(r, 150));
        const image = await wv.capturePage();
        steps.push({ dataUrl: image.toDataURL(), y });
        y += dims.viewportHeight;
      }
      await wv.executeJavaScript("window.scrollTo(0, 0)");

      const totalHeight = Math.min(dims.height, dims.viewportHeight * MAX_STEPS);
      const canvas = document.createElement("canvas");
      canvas.width = dims.viewportWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      for (const step of steps) {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = step.dataUrl;
        });
        ctx.drawImage(img, 0, step.y);
      }

      const base64 = canvas.toDataURL("image/png").split(",")[1];
      const name = `${(active.title || "page").replace(/[\\/:*?"<>|]/g, "_")}-full-page.png`;
      const result = await window.anchoran.saveAndOpenFile(name, base64);
      pushNotification("Browser", result.success ? "Full-page screenshot saved." : result.error ?? "Couldn't save the screenshot.");
    } catch {
      pushNotification("Browser", "Couldn't capture this page.");
    }
  }

  function onToggleTrackerBlock() {
    const next = !trackerBlock;
    setTrackerBlock(next);
    window.anchoran?.setTrackerBlock(next);
  }

  async function clearBrowsingData() {
    const result = await window.anchoran?.clearBrowserData();
    pushNotification("Browser", result?.success ? "Cleared cookies and site data." : result?.error ?? "Couldn't clear browsing data.");
  }

  const suggestions = useMemo(() => {
    const q = addressInput.trim().toLowerCase();
    if (!q || !addressFocused) return [];
    const fromHistory = history.filter((h) => h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q)).slice(0, 4);
    const fromBookmarks = bookmarks.filter((b) => b.url.toLowerCase().includes(q) || b.title.toLowerCase().includes(q)).slice(0, 4);
    const seen = new Set<string>();
    return [...fromBookmarks, ...fromHistory].filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).slice(0, 6);
  }, [addressInput, addressFocused, history, bookmarks]);

  // Live search-query suggestions — a query typed that doesn't look
  // like a URL fetches real autocomplete suggestions from Google's
  // public, key-free suggest endpoint (the same one several real
  // browsers' own address bars call), debounced so it only fires once
  // typing pauses.
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  useEffect(() => {
    const q = addressInput.trim();
    const looksLikeUrl = /^https?:\/\//i.test(q) || /^[\w-]+(\.[\w-]+)+/.test(q);
    if (!q || !addressFocused || looksLikeUrl) {
      setSearchSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!cancelled) setSearchSuggestions(Array.isArray(data?.[1]) ? data[1].slice(0, 5) : []);
      } catch {
        if (!cancelled) setSearchSuggestions([]);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addressInput, addressFocused]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
      } else if (mod && e.key === "t") {
        e.preventDefault();
        openTab(NEW_TAB_URL);
      } else if (mod && e.key === "w") {
        e.preventDefault();
        closeTab(activeId);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        reopenClosed();
      } else if (mod && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        zoomBy(0.1);
      } else if (mod && e.key === "-") {
        e.preventDefault();
        zoomBy(-0.1);
      } else if (mod && e.key === "0") {
        e.preventDefault();
        zoomReset();
      } else if (e.key === "Escape" && findOpen) {
        closeFind();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, findOpen]);

  const isSecure = active?.url.startsWith("https://");
  const isInsecure = active?.url.startsWith("http://");

  return (
    <div className="app-root browser-root">
      <div className="browser-tabbar">
        {tabs.map((t) => (
          <div
            key={t.id}
            className="browser-tab"
            data-active={t.id === activeId}
            data-pinned={t.pinned}
            style={{
              position: "relative",
              ...(t.groupId ? { boxShadow: `inset 0 2px 0 ${groups.find((g) => g.id === t.groupId)?.color ?? "transparent"}` } : {}),
            }}
            onClick={() => setActiveId(t.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setTabMenu({ x: e.clientX, y: e.clientY, id: t.id });
            }}
            onMouseEnter={() => scheduleTabPreview(t.id)}
            onMouseLeave={cancelTabPreview}
          >
            {t.loading ? (
              <div className="browser-tab-spinner" />
            ) : t.favicon ? (
              <img src={t.favicon} alt="" className="browser-tab-favicon" />
            ) : (
              <Icon name="browser" size={13} />
            )}
            {!t.pinned && <span className="browser-tab-title">{t.title || "New Tab"}</span>}
            {t.incognito && <Icon name="lock" size={11} />}
            {!t.pinned && (
              <button
                className="browser-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
                }}
                aria-label="Close tab"
              >
                <Icon name="close" size={11} />
              </button>
            )}
            {tabPreview?.id === t.id && (
              <div className="browser-tab-preview">
                <img src={tabPreview.dataUrl} alt="" />
                <div className="browser-tab-preview-title">{t.title || "New Tab"}</div>
              </div>
            )}
          </div>
        ))}
        <button className="browser-tab-new" onClick={() => openTab(NEW_TAB_URL)} aria-label="New tab">
          <Icon name="plus" size={13} />
        </button>
        <button className="browser-tab-new" onClick={() => openTab(NEW_TAB_URL, { incognito: true })} aria-label="New incognito tab" title="New incognito tab">
          <Icon name="lock" size={12} />
        </button>
      </div>

      {tabMenu && (
        <ContextMenu
          x={tabMenu.x}
          y={tabMenu.y}
          onClose={() => setTabMenu(null)}
          items={(() => {
            const t = tabs.find((tab) => tab.id === tabMenu.id);
            const entries: ContextMenuEntry[] = [
              {
                label: t?.pinned ? "Unpin tab" : "Pin tab",
                onSelect: () => togglePin(tabMenu.id),
              },
              { label: "Duplicate tab", onSelect: () => duplicateTab(tabMenu.id) },
              ...(t && t.url !== NEW_TAB_URL
                ? [
                    {
                      label: "Create desktop shortcut…",
                      onSelect: () =>
                        useShortcutsStore
                          .getState()
                          .addShortcut({ appId: "browser" as const, title: t.title || t.url, openPath: t.url }),
                    },
                  ]
                : []),
              { separator: true },
              ...(t?.groupId
                ? [
                    { label: "Remove from group", onSelect: () => removeFromGroup(tabMenu.id) },
                    { label: "Close group", danger: true, onSelect: () => closeGroup(t.groupId!) },
                  ]
                : [
                    { label: "New group from this tab", onSelect: () => createGroup(tabMenu.id) },
                    ...groups.map((g) => ({
                      label: `Add to "${g.name}"`,
                      onSelect: () => addToGroup(tabMenu.id, g.id),
                    })),
                  ]),
              { separator: true },
              { label: "Close others", onSelect: () => closeOthers(tabMenu.id) },
              { label: "Close tabs to the right", onSelect: () => closeToRight(tabMenu.id) },
              { separator: true },
              { label: "Close tab", danger: true, onSelect: () => closeTab(tabMenu.id) },
            ];
            return entries;
          })()}
        />
      )}

      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={goBack} disabled={!active?.canGoBack}>
          <Icon name="chevronRight" size={13} style={{ transform: "rotate(180deg)" }} />
        </button>
        <button className="app-toolbar-btn" onClick={goForward} disabled={!active?.canGoForward}>
          <Icon name="chevronRight" size={13} />
        </button>
        <button className="app-toolbar-btn" onClick={reload}>
          <Icon name="restart" size={13} />
        </button>
        <div className="browser-address-wrap">
          {isSecure && <Icon name="lock" size={13} />}
          <input
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            onFocus={() => setAddressFocused(true)}
            onBlur={() => setTimeout(() => setAddressFocused(false), 120)}
            onKeyDown={(e) => e.key === "Enter" && go(addressInput)}
            placeholder="Search or enter address"
            className="browser-address-input"
          />
          {(suggestions.length > 0 || searchSuggestions.length > 0) && (
            <div className="browser-suggestions">
              {searchSuggestions.map((q) => (
                <button key={`search-${q}`} className="browser-suggestion-row" onMouseDown={() => go(q)}>
                  <Icon name="search" size={12} />
                  <span className="browser-suggestion-title">{q}</span>
                </button>
              ))}
              {suggestions.map((s) => (
                <button key={s.url} className="browser-suggestion-row" onMouseDown={() => go(s.url)}>
                  <Icon name="search" size={12} />
                  <span className="browser-suggestion-title">{s.title || s.url}</span>
                  <span className="browser-suggestion-url">{s.url}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="app-toolbar-btn" onClick={toggleBookmark} disabled={!active || active.url === NEW_TAB_URL} title="Bookmark this page">
          <Icon name="pin" size={13} style={isBookmarked(active?.url ?? "") ? { color: "var(--anchoran-accent)" } : undefined} />
        </button>
        <button className="app-toolbar-btn" onClick={() => setFindOpen(true)} title="Find in page">
          <Icon name="search" size={13} />
        </button>
        <button
          className="app-toolbar-btn"
          onClick={openReaderMode}
          disabled={!active || active.url === NEW_TAB_URL || readerLoading}
          title="Reading mode"
        >
          <Icon name="document" size={13} />
        </button>
        <div style={{ position: "relative" }}>
          <button
            className="app-toolbar-btn"
            onClick={() => setTranslateMenuOpen((v) => !v)}
            disabled={!active || active.url === NEW_TAB_URL}
            title="Translate page"
          >
            <Icon name="globe" size={13} />
          </button>
          {translateMenuOpen && (
            <div className="browser-translate-menu">
              {[
                ["en", "English"],
                ["es", "Español"],
                ["pt", "Português"],
                ["fr", "Français"],
                ["de", "Deutsch"],
              ].map(([code, label]) => (
                <button key={code} onClick={() => translatePage(code)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="app-toolbar-btn" data-op={panel === "history"} onClick={() => setPanel(panel === "history" ? null : "history")}>
          History
        </button>
        <button className="app-toolbar-btn" data-op={panel === "bookmarks"} onClick={() => setPanel(panel === "bookmarks" ? null : "bookmarks")}>
          Bookmarks
        </button>
        <button className="app-toolbar-btn" data-op={panel === "downloads"} onClick={() => setPanel(panel === "downloads" ? null : "downloads")}>
          Downloads {downloads.some((d) => d.state === "progressing") ? "…" : ""}
        </button>
        <button className="app-toolbar-btn" data-op={active?.darkMode} onClick={toggleDarkMode} title="Force dark mode for this page">
          Dark
        </button>
        <button className="app-toolbar-btn" data-op={trackerBlock} onClick={onToggleTrackerBlock} title="Block common ad/tracker domains">
          Block trackers
        </button>
        <button
          className="app-toolbar-btn"
          title="More (zoom, print, save, tab actions)"
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setPageMenu({ x: rect.right, y: rect.bottom + 4 });
          }}
        >
          ⋮
        </button>
      </div>

      {isInsecure && (
        <div className="browser-insecure-banner">This site doesn't use a secure (HTTPS) connection.</div>
      )}

      {findOpen && (
        <div className="browser-findbar">
          <input
            autoFocus
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runFind(!e.shiftKey);
              if (e.key === "Escape") closeFind();
            }}
            placeholder="Find in page…"
          />
          {findResult && (
            <span className="browser-find-count">
              {findResult.matches > 0 ? `${findResult.active}/${findResult.matches}` : "0 results"}
            </span>
          )}
          <button className="app-toolbar-btn" onClick={() => runFind(true)}>
            Next
          </button>
          <button className="app-toolbar-btn" onClick={() => runFind(false)}>
            Prev
          </button>
          <button className="app-toolbar-btn" onClick={closeFind}>
            <Icon name="close" size={12} />
          </button>
        </div>
      )}

      {pageMenu && (
        <ContextMenu
          x={pageMenu.x}
          y={pageMenu.y}
          onClose={() => setPageMenu(null)}
          items={[
            { label: "Zoom out (−)", onSelect: () => zoomBy(-0.1) },
            { label: `Zoom: ${Math.round((active?.zoom ?? 1) * 100)}% (reset)`, onSelect: zoomReset },
            { label: "Zoom in (+)", onSelect: () => zoomBy(0.1) },
            { separator: true },
            { label: "Print", onSelect: printPage },
            { label: "Save as PDF", onSelect: saveAsPdf },
            { label: "Full-page screenshot", onSelect: captureFullPage },
            { label: "Save page…", onSelect: () => setSavePagePicker(true) },
            { label: "Copy link", onSelect: copyLink },
            { separator: true },
            { label: "Duplicate tab", onSelect: () => duplicateTab(activeId) },
            { label: "Close others", onSelect: () => closeOthers(activeId) },
            { label: "Close tabs to the right", onSelect: () => closeToRight(activeId) },
            { label: "Reopen closed tab", disabled: closedStack.current.length === 0, onSelect: reopenClosed },
          ]}
        />
      )}

      <div className="app-content browser-content" style={{ padding: 0 }}>
        {tabs.map((t) => {
          const isDiscarded = t.id !== activeId && !t.pinned && Date.now() - t.lastActiveAt > DISCARD_AFTER_MS;
          if (isDiscarded) return null; // unmounted — see DISCARD_AFTER_MS above; reactivating remounts fresh from t.url
          return (
            <BrowserTabView key={t.id} tab={t} active={t.id === activeId} trackerBlock={trackerBlock} onUpdate={updateTab} onNewTab={openTab} registerRef={registerRef} />
          );
        })}
      </div>

      {panel === "history" && (
        <div className="browser-panel">
          <div className="browser-panel-header">
            <span>History</span>
            <button className="app-toolbar-btn" onClick={clearHistory}>
              Clear all
            </button>
          </div>
          {history.length === 0 && <div className="browser-panel-empty">No history yet.</div>}
          {history.map((h) => (
            <div key={`${h.url}-${h.visitedAt}`} className="browser-panel-row" onClick={() => go(h.url)}>
              <span className="browser-panel-title">{h.title || h.url}</span>
              <span className="browser-panel-meta">{new Date(h.visitedAt).toLocaleString()}</span>
              <button
                className="browser-panel-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeHistoryEntry(h.url, h.visitedAt);
                }}
              >
                <Icon name="close" size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {panel === "bookmarks" && (
        <div className="browser-panel">
          <div className="browser-panel-header">
            <span>Bookmarks</span>
          </div>
          {bookmarks.length === 0 && <div className="browser-panel-empty">No bookmarks yet — click the pin icon to add one.</div>}
          {(() => {
            const folders = Array.from(new Set(bookmarks.map((b) => b.folder).filter((f): f is string => !!f))).sort();
            const unfiled = bookmarks.filter((b) => !b.folder);
            function bookmarkRow(b: Bookmark) {
              return (
                <div key={b.url} className="browser-panel-row" onClick={() => go(b.url)}>
                  <span className="browser-panel-title">{b.title || b.url}</span>
                  <input
                    className="browser-bookmark-folder-input"
                    defaultValue={b.folder ?? ""}
                    placeholder="Folder…"
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => setBookmarkFolder(b.url, e.target.value.trim() || null)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  />
                  <button
                    className="browser-panel-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBookmark(b.url);
                    }}
                  >
                    <Icon name="close" size={11} />
                  </button>
                </div>
              );
            }
            return (
              <>
                {folders.map((folder) => (
                  <div key={folder}>
                    <div className="browser-bookmark-folder-label">
                      <Icon name="folder" size={12} /> {folder}
                    </div>
                    {bookmarks.filter((b) => b.folder === folder).map(bookmarkRow)}
                  </div>
                ))}
                {unfiled.map(bookmarkRow)}
              </>
            );
          })()}
        </div>
      )}

      {panel === "downloads" && (
        <div className="browser-panel">
          <div className="browser-panel-header">
            <span>Downloads</span>
            <button className="app-toolbar-btn" onClick={() => setDownloads([])}>
              Clear list
            </button>
          </div>
          {downloads.length === 0 && <div className="browser-panel-empty">No downloads yet.</div>}
          {downloads.map((d) => (
            <div key={d.id} className="browser-panel-row">
              <span className="browser-panel-title">
                {d.fileName}
                {d.state === "progressing" && d.totalBytes > 0 && ` — ${Math.round((d.receivedBytes / d.totalBytes) * 100)}%`}
                {d.state === "cancelled" && " — cancelled"}
                {d.state === "interrupted" && " — failed"}
              </span>
              {d.state === "completed" && (
                <>
                  <button className="app-toolbar-btn" onClick={() => window.anchoran?.openDownload(d.path)}>
                    Open
                  </button>
                  <button className="app-toolbar-btn" onClick={() => window.anchoran?.showDownloadInExplorer(d.path)}>
                    Show
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="browser-statusbar">
        <button className="browser-clear-data-btn" onClick={clearBrowsingData}>
          Clear browsing data
        </button>
        {trackerBlock && blockedCount > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--anchoran-text-secondary)" }}>
            {blockedCount} ads/trackers blocked this session
          </span>
        )}
      </div>

      {savePagePicker && (
        <AnchoranFilePicker
          mode="folder"
          title="Save page to…"
          onConfirm={onSavePageComplete}
          onCancel={() => setSavePagePicker(false)}
        />
      )}

      {readerContent && (
        <div className="browser-reader-overlay" onClick={() => setReaderContent(null)}>
          <div className="browser-reader-page" onClick={(e) => e.stopPropagation()}>
            <button className="browser-reader-close" onClick={() => setReaderContent(null)} aria-label="Exit reading mode">
              <Icon name="close" size={16} />
            </button>
            <h1 className="browser-reader-title">{readerContent.title}</h1>
            {readerContent.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
