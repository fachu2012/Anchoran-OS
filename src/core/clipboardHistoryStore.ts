import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";

/**
 * A history of text copied anywhere inside Anchoran, captured via a
 * single window-level "copy" listener (see Desktop.tsx) — real text
 * from real copy events, not a simulation. Anchoran can only observe
 * copies that happen inside its own window (any `<webview>` guest page
 * copy stays outside it, the same boundary Electron enforces for
 * everything else about a webview's content).
 */

export interface ClipboardEntry {
  id: string;
  text: string;
  copiedAt: number;
}

const STORAGE_KEY = "clipboardHistory";
const RETENTION_KEY = "clipboardRetentionMinutes";
const MAX_ENTRIES = 50;

interface ClipboardHistoryState {
  entries: ClipboardEntry[];
  hydrated: boolean;
  /** Minutes after which an entry is auto-purged from history; 0 means "keep forever". A privacy option for anything sensitive that briefly passes through the clipboard. */
  retentionMinutes: number;
  record: (text: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  setRetentionMinutes: (minutes: number) => void;
}

function persist(entries: ClipboardEntry[]) {
  persistSet("data", STORAGE_KEY, entries);
}

export const useClipboardHistoryStore = create<ClipboardHistoryState>((set, get) => ({
  entries: [],
  hydrated: false,
  retentionMinutes: 0,

  record: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const withoutDupes = get().entries.filter((e) => e.text !== trimmed);
    const entries = [{ id: `${Date.now()}`, text: trimmed, copiedAt: Date.now() }, ...withoutDupes].slice(
      0,
      MAX_ENTRIES
    );
    set({ entries });
    persist(entries);
  },

  remove: (id) => {
    const entries = get().entries.filter((e) => e.id !== id);
    set({ entries });
    persist(entries);
  },

  clear: () => {
    set({ entries: [] });
    persist([]);
  },

  setRetentionMinutes: (minutes) => {
    set({ retentionMinutes: minutes });
    persistSet("config", RETENTION_KEY, minutes);
  },
}));

persistGet<ClipboardEntry[]>("data", STORAGE_KEY, []).then((entries) => {
  useClipboardHistoryStore.setState({ entries, hydrated: true });
});

persistGet<number>("config", RETENTION_KEY, 0).then((retentionMinutes) => {
  useClipboardHistoryStore.setState({ retentionMinutes });
});

// Purges entries older than the configured retention window every
// minute — a no-op while retentionMinutes is 0 (the default: keep
// everything, same as before this feature existed).
setInterval(() => {
  const { retentionMinutes, entries } = useClipboardHistoryStore.getState();
  if (!retentionMinutes) return;
  const cutoff = Date.now() - retentionMinutes * 60_000;
  const kept = entries.filter((e) => e.copiedAt >= cutoff);
  if (kept.length !== entries.length) {
    useClipboardHistoryStore.setState({ entries: kept });
    persist(kept);
  }
}, 60_000);
