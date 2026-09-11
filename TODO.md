# Anchoran OS — To-Do

Larger, not-yet-started ideas that don't fit neatly into a single wave of work. Smaller pending items live in CHANGELOG.md history and conversation notes; this file is for standalone future initiatives.

## Secondary OS / System Mode — implemented, needs real-hardware verification

**Status: core implementation done (v1.19.0). Not yet confirmed working on an actual physical keyboard/session by the user — do that before relying on it.**

What it does: Anchoran can now claim the Windows key and Alt+Tab system-wide while it's running, via a native low-level keyboard hook (`native/kioskhook`), without touching anything about how Windows itself boots, logs in, or what the user had open before launching Anchoran. Toggle lives in Settings → System Mode, off by default every session (never persisted as "was on").

How it works, in short:
- `native/kioskhook/Program.cs` — a small standalone .NET 8 console app (self-contained single-file publish, so end users need nothing extra installed) that installs a `WH_KEYBOARD_LL` hook, swallows only the Windows key and Alt+Tab (prints `WIN` / `ALTTAB` to stdout each time), and does nothing else. Exits on an `EXIT` line over stdin, or on its own within ~1s if its parent process (Anchoran) disappears — a watchdog thread, independent of the graceful-shutdown path.
- `electron/main.ts` spawns/kills this process (`anchoran:system-mode-start` / `-stop` / `-status` IPC) and relays its two possible output lines to the renderer as `anchoran:system-mode-key`.
- `src/App.tsx` wires `WIN` → toggle the Launcher, `ALTTAB` → `cycleFocus` (the same window switcher Ctrl+Tab already opens).
- `src/desktop/systemModeStore.ts` / Settings → System Mode is the on/off UI, with a plain-language explanation and the Ctrl+Alt+Delete/reboot safety notes.
- Packaging: `npm run build:kioskhook` (`dotnet publish`) must run before `electron-builder` — wired into `npm run dist` and `.github/workflows/release.yml` (which now also sets up the .NET SDK). The compiled `.exe` ships as an `extraResource`, resolved in `electron/main.ts` via `app.isPackaged`.

Safety properties (see `native/kioskhook/Program.cs` header comment for the full reasoning):
- Ctrl+Alt+Delete can never be intercepted by a user-mode hook — enforced by Windows itself, unconditionally.
- The hook only exists while this specific child process is alive; turning System Mode off, closing Anchoran, a crash, or a physical reboot all release the keys immediately with no lingering state.
- Not a Winlogon shell replacement — Windows' own login/boot process is never touched.

Still to do before calling this finished:
- **Real on-device confirmation** that pressing the physical Windows key and Alt+Tab actually behave as expected, with System Mode on and off — this was built and unit-tested (the helper process starts, reports READY, responds to EXIT, and the full pipe protocol was verified end-to-end via Node's `child_process`), but the actual key-suppression behavior was deliberately not exercised by simulating real key presses during development, to avoid interfering with the live desktop it was built on.
- Code signing for `AnchoranKioskHook.exe` — a global keyboard hook is a pattern antivirus/SmartScreen heuristics flag; unsigned, it may trigger warnings on first run or install. Not yet addressed.
- Carry the existing fullscreen boot/shutdown/update theater into this mode specifically (it already applies regardless of System Mode being on, since System Mode doesn't change Anchoran's own window — worth confirming this holds once tested for real).
- Revisit the "must fully quit to self-update" limitation in this context, as originally noted.
