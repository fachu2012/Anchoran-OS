import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";

export type ModifierCombo = "ctrlAlt" | "ctrlShift" | "altShift";

export const MODIFIER_LABELS: Record<ModifierCombo, string> = {
  ctrlAlt: "Ctrl + Alt",
  ctrlShift: "Ctrl + Shift",
  altShift: "Alt + Shift",
};

export function matchesModifier(e: KeyboardEvent, combo: ModifierCombo): boolean {
  switch (combo) {
    case "ctrlAlt":
      return e.ctrlKey && e.altKey && !e.shiftKey;
    case "ctrlShift":
      return e.ctrlKey && e.shiftKey && !e.altKey;
    case "altShift":
      return e.altKey && e.shiftKey && !e.ctrlKey;
  }
}

const KEY = "shortcutModifiers";

interface ShortcutPrefsState {
  /** Snap-to-thirds (Left/Right/Down) and switch-virtual-desktop (Page Up/Down) share one modifier, since they never fire on the same keys. */
  desktopModifier: ModifierCombo;
  /** Keyboard window resize (Arrow keys). */
  resizeModifier: ModifierCombo;
  setDesktopModifier: (combo: ModifierCombo) => void;
  setResizeModifier: (combo: ModifierCombo) => void;
}

/** Customizable keyboard shortcuts — a curated choice of modifier combo per renderer-owned shortcut group, rather than free-form rebinding (which real OS-level shortcuts like the Launcher's need Electron's own re-registration for — out of scope here; see electron/main.ts's own Ctrl+Alt+L fallback). */
export const useShortcutPrefsStore = create<ShortcutPrefsState>((set) => ({
  desktopModifier: "ctrlAlt",
  resizeModifier: "ctrlShift",
  setDesktopModifier: (combo) => {
    set({ desktopModifier: combo });
    persistSet("config", KEY, { desktopModifier: combo, resizeModifier: useShortcutPrefsStore.getState().resizeModifier });
  },
  setResizeModifier: (combo) => {
    set({ resizeModifier: combo });
    persistSet("config", KEY, { desktopModifier: useShortcutPrefsStore.getState().desktopModifier, resizeModifier: combo });
  },
}));

persistGet<{ desktopModifier: ModifierCombo; resizeModifier: ModifierCombo }>("config", KEY, {
  desktopModifier: "ctrlAlt",
  resizeModifier: "ctrlShift",
}).then((saved) => {
  useShortcutPrefsStore.setState(saved);
});
