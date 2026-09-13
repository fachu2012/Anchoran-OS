import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";

const KEY = "fileFavorites";

interface FavoritesState {
  paths: Set<string>;
  toggle: (path: string) => void;
}

/** A simple favorite/star flag per real file or folder path, shown as a quick-filter and a marker in Files' rows. */
export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  paths: new Set(),
  toggle: (path) => {
    const paths = new Set(get().paths);
    if (paths.has(path)) paths.delete(path);
    else paths.add(path);
    set({ paths });
    persistSet("config", KEY, Array.from(paths));
  },
}));

persistGet<string[]>("config", KEY, []).then((saved) => {
  useFavoritesStore.setState({ paths: new Set(saved) });
});
