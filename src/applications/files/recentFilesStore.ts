import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";

export interface RecentFile {
  path: string;
  name: string;
  openedAt: number;
}

const KEY = "recentFiles";
const MAX_ENTRIES = 30;

interface RecentFilesState {
  files: RecentFile[];
  record: (path: string, name: string) => void;
  clear: () => void;
}

/** A real "recently opened" list, independent of which folder a file happens to live in — Files' own quick-links only ever showed the current folder before this. */
export const useRecentFilesStore = create<RecentFilesState>((set, get) => ({
  files: [],
  record: (path, name) => {
    const withoutDupe = get().files.filter((f) => f.path !== path);
    const files = [{ path, name, openedAt: Date.now() }, ...withoutDupe].slice(0, MAX_ENTRIES);
    set({ files });
    persistSet("config", KEY, files);
  },
  clear: () => {
    set({ files: [] });
    persistSet("config", KEY, []);
  },
}));

persistGet<RecentFile[]>("config", KEY, []).then((files) => {
  useRecentFilesStore.setState({ files });
});
