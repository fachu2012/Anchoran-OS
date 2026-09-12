import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";

export interface HistoryEntry {
  url: string;
  title: string;
  visitedAt: number;
}

export interface Bookmark {
  url: string;
  title: string;
  addedAt: number;
}

const HISTORY_KEY = "browserHistory";
const BOOKMARKS_KEY = "browserBookmarks";
const HISTORY_LIMIT = 500;

interface BrowserDataState {
  history: HistoryEntry[];
  bookmarks: Bookmark[];
  hydrated: boolean;
  recordVisit: (url: string, title: string) => void;
  clearHistory: () => void;
  removeHistoryEntry: (url: string, visitedAt: number) => void;
  addBookmark: (url: string, title: string) => void;
  removeBookmark: (url: string) => void;
  isBookmarked: (url: string) => boolean;
}

function persistHistory(history: HistoryEntry[]) {
  persistSet("data", HISTORY_KEY, history);
}
function persistBookmarks(bookmarks: Bookmark[]) {
  persistSet("data", BOOKMARKS_KEY, bookmarks);
}

/**
 * Bookmarks and history for the Browser app — kept in Anchoran's
 * normal shared "data" store, the same as every other app's data
 * (Notes, Files, …), matching the project's existing rule that app
 * data is shared across user profiles rather than siloed per profile.
 */
export const useBrowserStore = create<BrowserDataState>((set, get) => ({
  history: [],
  bookmarks: [],
  hydrated: false,

  recordVisit: (url, title) => {
    const entry: HistoryEntry = { url, title, visitedAt: Date.now() };
    const history = [entry, ...get().history].slice(0, HISTORY_LIMIT);
    set({ history });
    persistHistory(history);
  },

  clearHistory: () => {
    set({ history: [] });
    persistHistory([]);
  },

  removeHistoryEntry: (url, visitedAt) => {
    const history = get().history.filter((h) => !(h.url === url && h.visitedAt === visitedAt));
    set({ history });
    persistHistory(history);
  },

  addBookmark: (url, title) => {
    if (get().bookmarks.some((b) => b.url === url)) return;
    const bookmarks = [{ url, title, addedAt: Date.now() }, ...get().bookmarks];
    set({ bookmarks });
    persistBookmarks(bookmarks);
  },

  removeBookmark: (url) => {
    const bookmarks = get().bookmarks.filter((b) => b.url !== url);
    set({ bookmarks });
    persistBookmarks(bookmarks);
  },

  isBookmarked: (url) => get().bookmarks.some((b) => b.url === url),
}));

Promise.all([
  persistGet<HistoryEntry[]>("data", HISTORY_KEY, []),
  persistGet<Bookmark[]>("data", BOOKMARKS_KEY, []),
]).then(([history, bookmarks]) => {
  useBrowserStore.setState({ history, bookmarks, hydrated: true });
});
