import { describe, expect, it } from "vitest";
import { matchesModifier } from "./shortcutPrefsStore";

function key(overrides: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "ArrowLeft", ctrlKey: false, altKey: false, shiftKey: false, ...overrides });
}

describe("matchesModifier", () => {
  it("matches ctrlAlt only when Ctrl and Alt are held, and Shift is not", () => {
    expect(matchesModifier(key({ ctrlKey: true, altKey: true }), "ctrlAlt")).toBe(true);
    expect(matchesModifier(key({ ctrlKey: true, altKey: true, shiftKey: true }), "ctrlAlt")).toBe(false);
    expect(matchesModifier(key({ ctrlKey: true }), "ctrlAlt")).toBe(false);
  });

  it("matches ctrlShift only when Ctrl and Shift are held, and Alt is not", () => {
    expect(matchesModifier(key({ ctrlKey: true, shiftKey: true }), "ctrlShift")).toBe(true);
    expect(matchesModifier(key({ ctrlKey: true, shiftKey: true, altKey: true }), "ctrlShift")).toBe(false);
  });

  it("matches altShift only when Alt and Shift are held, and Ctrl is not", () => {
    expect(matchesModifier(key({ altKey: true, shiftKey: true }), "altShift")).toBe(true);
    expect(matchesModifier(key({ altKey: true, shiftKey: true, ctrlKey: true }), "altShift")).toBe(false);
  });

  it("never matches a bare key with no modifiers held", () => {
    expect(matchesModifier(key(), "ctrlAlt")).toBe(false);
    expect(matchesModifier(key(), "ctrlShift")).toBe(false);
    expect(matchesModifier(key(), "altShift")).toBe(false);
  });
});
