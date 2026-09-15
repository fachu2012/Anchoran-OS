# Anchoran OS — To-Do

Larger, not-yet-started ideas that don't fit neatly into a single wave of work. Smaller pending items live in CHANGELOG.md history and conversation notes; this file is for standalone future initiatives.

## Secondary OS / System Mode — implemented, unconditional since v3.8.0, needs real-hardware verification

**Status: core desktop-takeover implementation done (v1.19.0, made unconditional and expanded to full display takeover + crash watchdog in v3.8.0, with a Task-Manager-survival fix in v3.8.1). Several pieces still need confirmation on a real Windows machine — see below.**

What it does today: on every launch, after the boot confirmation screen, Anchoran claims the Windows key and Alt+Tab system-wide (`native/kioskhook`) and hides/throttles every other real, visible window on its own monitor to near-zero CPU — restored exactly the moment Anchoran exits, by any path. This is unconditional, not a Settings toggle: the fullscreen "Confirm Anchoran OS startup? [y/n]" screen (`src/boot/BootConfirmGate.tsx`) is what the user agrees to it with, every single launch, and there is no Settings section or Terminal command to turn it off anymore (removed in v3.8.0). `src/desktop/systemModeStore.ts` is just the internal start()/stop() API `App.tsx` calls, not user-facing.

How it works, in short:
- `native/kioskhook/Program.cs` — a small standalone .NET 8 console app (self-contained single-file publish) that installs a `WH_KEYBOARD_LL` hook (swallows only the Windows key and Alt+Tab, printing `WIN`/`ALTTAB` to stdout) and hides/throttles every other top-level window on Anchoran's own monitor. Exits on an `EXIT` line over stdin, or on its own within ~1s if Anchoran's pid (passed explicitly as an argument, not via OS parentage) disappears — restoring everything it hid/throttled either way.
- `native/launcher/Program.cs` (added v3.8.1) — spawns kioskhook (and the watchdog) reporting `explorer.exe`, not Anchoran, as their parent process, so Task Manager's grouped "End task" on Anchoran no longer reaches and kills them too. Stays alive proxying stdio and exit code until the real target exits, so `electron/main.ts`'s existing lifecycle tracking (stdout `WIN`/`ALTTAB`, stdin `EXIT`, the `exit` event) keeps working unchanged.
- `native/watchdog/Program.cs` (rewritten as native in v3.8.1, was a Node script before) — a genuinely separate process watching Anchoran's own pid + a heartbeat pipe, relaunching a crash screen (`src/boot/WatchdogCrashScreen.tsx`) if either goes quiet.
- `electron/main.ts` spawns/kills kioskhook (`anchoran:system-mode-start`/`-stop`/`-status` IPC, now routed through the launcher) and relays its two possible output lines to the renderer as `anchoran:system-mode-key`.
- `src/App.tsx` wires `WIN` → toggle the Launcher, `ALTTAB` → `cycleFocus` (the same window switcher Ctrl+Tab already opens), and calls `useSystemModeStore.getState().start()` unconditionally once the boot confirmation is answered "y".
- Packaging: `npm run build:kioskhook`/`build:windowembed`/`build:launcher`/`build:watchdog` (`dotnet publish` each) must run before `electron-builder` — wired into `npm run dist`. Each compiled `.exe` ships as an `extraResource`, resolved in `electron/main.ts` via `app.isPackaged`.

Safety properties (see `native/kioskhook/Program.cs` header comment for the full reasoning):
- Ctrl+Alt+Delete can never be intercepted by a user-mode hook — enforced by Windows itself, unconditionally. Signing out from that screen does close Anchoran (it's a normal window-close from Windows' perspective).
- The hook only exists while this specific child process is alive; kioskhook watches Anchoran's pid directly (not via OS parentage) and self-restores within ~1s if it disappears, by any path — including a Task Manager grouped kill, since v3.8.1's launcher reparenting.
- Not a Winlogon shell replacement — Windows' own login/boot process is never touched.

Still to do before calling this finished:
- **Real on-device confirmation of the v3.8.1 Task-Manager-survival fix** — the `PROC_THREAD_ATTRIBUTE_PARENT_PROCESS` reparenting technique in `native/launcher` was implemented and reasoned through carefully but could not be verified without a real Windows machine; test by force-closing "Anchoran OS" via Task Manager's grouped "End task" and confirming both the crash screen (watchdog) appears and every hidden/throttled app comes back (kioskhook).
- **Real on-device confirmation** that pressing the physical Windows key and Alt+Tab actually behave as expected — the underlying hook mechanism is unit-tested end-to-end via Node's `child_process`, but real key-suppression was deliberately not exercised during development to avoid interfering with the live desktop it was built on.
- Code signing for `AnchoranKioskHook.exe`, `AnchoranWatchdog.exe`, `AnchoranLauncher.exe`, `AnchoranWindowEmbed.exe` — a global keyboard hook and a parent-spoofing launcher are exactly the kind of pattern antivirus/SmartScreen heuristics flag; unsigned, any of them may trigger warnings on first run or install. Not yet addressed.
- Revisit the "must fully quit to self-update" limitation in this context, as originally noted.
