import { beforeEach, describe, expect, it } from "vitest";
import { useFavoritesStore } from "./favoritesStore";

function resetStore() {
  useFavoritesStore.setState({ paths: new Set() });
}

describe("favoritesStore", () => {
  beforeEach(resetStore);

  it("toggling an unfavorited path adds it", () => {
    useFavoritesStore.getState().toggle("C:\\Users\\me\\file.txt");
    expect(useFavoritesStore.getState().paths.has("C:\\Users\\me\\file.txt")).toBe(true);
  });

  it("toggling an already-favorited path removes it", () => {
    const { toggle } = useFavoritesStore.getState();
    toggle("C:\\Users\\me\\file.txt");
    toggle("C:\\Users\\me\\file.txt");
    expect(useFavoritesStore.getState().paths.has("C:\\Users\\me\\file.txt")).toBe(false);
  });

  it("tracks multiple favorites independently", () => {
    const { toggle } = useFavoritesStore.getState();
    toggle("a.txt");
    toggle("b.txt");
    toggle("a.txt");
    const { paths } = useFavoritesStore.getState();
    expect(paths.has("a.txt")).toBe(false);
    expect(paths.has("b.txt")).toBe(true);
  });
});
