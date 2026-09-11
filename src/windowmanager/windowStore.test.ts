import { beforeEach, describe, expect, it } from "vitest";
import { useWindowStore } from "./windowStore";

function resetStore() {
  useWindowStore.setState({
    windows: [],
    focusedWindowId: null,
    nextZIndex: 1,
    rememberedBounds: {},
    snapPreview: null,
  });
}

describe("windowStore", () => {
  beforeEach(resetStore);

  it("opens a new window and focuses it", () => {
    const id = useWindowStore.getState().openApp("notes");
    const state = useWindowStore.getState();
    expect(state.windows).toHaveLength(1);
    expect(state.focusedWindowId).toBe(id);
  });

  it("reuses the existing window for single-instance apps", () => {
    const first = useWindowStore.getState().openApp("settings");
    const second = useWindowStore.getState().openApp("settings");
    expect(second).toBe(first);
    expect(useWindowStore.getState().windows).toHaveLength(1);
  });

  it("allows multiple instances for apps that opt in", () => {
    useWindowStore.getState().openApp("terminal");
    useWindowStore.getState().openApp("terminal");
    expect(useWindowStore.getState().windows).toHaveLength(2);
  });

  it("closes a window and removes it from state", () => {
    const id = useWindowStore.getState().openApp("notes");
    useWindowStore.getState().closeWindow(id);
    expect(useWindowStore.getState().windows).toHaveLength(0);
  });

  it("minimizing clears focus, restoring re-focuses", () => {
    const id = useWindowStore.getState().openApp("notes");
    useWindowStore.getState().minimizeWindow(id);
    expect(useWindowStore.getState().focusedWindowId).toBeNull();
    expect(useWindowStore.getState().windows[0].isMinimized).toBe(true);

    useWindowStore.getState().restoreWindow(id);
    expect(useWindowStore.getState().focusedWindowId).toBe(id);
    expect(useWindowStore.getState().windows[0].isMinimized).toBe(false);
  });

  it("toggleMaximize remembers and restores prior bounds", () => {
    const id = useWindowStore.getState().openApp("notes");
    const original = useWindowStore.getState().windows[0];

    useWindowStore.getState().toggleMaximize(id);
    expect(useWindowStore.getState().windows[0].isMaximized).toBe(true);

    useWindowStore.getState().toggleMaximize(id);
    const restored = useWindowStore.getState().windows[0];
    expect(restored.isMaximized).toBe(false);
    expect(restored.x).toBe(original.x);
    expect(restored.width).toBe(original.width);
  });

  it("cycleFocus moves focus between open windows and wraps around", () => {
    const a = useWindowStore.getState().openApp("notes");
    useWindowStore.getState().openApp("terminal");
    // focus is currently on the second window opened
    useWindowStore.getState().cycleFocus(1);
    const focusedAfterWrap = useWindowStore.getState().focusedWindowId;
    expect(focusedAfterWrap).toBe(a);
  });
});
