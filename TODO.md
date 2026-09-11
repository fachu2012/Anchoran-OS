# Anchoran OS — To-Do

Larger, not-yet-started ideas that don't fit neatly into a single wave of work. Smaller pending items live in CHANGELOG.md history and conversation notes; this file is for standalone future initiatives.

## Secondary OS / Kiosk Mode (instead of a plain launched .exe)

Goal: instead of Anchoran just being an app you open, let the user launch it as a full "secondary OS" layered on top of an already-running Windows session — Windows keeps running underneath with everything the user had open untouched, Anchoran takes over the whole screen and claims system-level inputs (Win key → Anchoran's own Launcher, Alt+Tab → Anchoran's own window switcher) while it's active, and closing Anchoran (via its own shutdown, or force-closing/rebooting if something goes wrong) hands control straight back to Windows exactly as it was left.

Key points from the design discussion (see conversation for full reasoning):
- **Not** a Windows shell replacement (`Winlogon\Shell` registry key) — that requires a sign-out/sign-in cycle to take effect and changes what happens at login. Explicitly ruled out in favor of the model below.
- Requires a real Windows low-level keyboard hook (`SetWindowsHookEx` + `WH_KEYBOARD_LL`) to actually claim the Win key and Alt+Tab while Anchoran is focused — Electron's built-in `globalShortcut` is not sufficient for either (confirmed by the existing Ctrl+Win/bare-Win-key failures already documented in `electron/main.ts`).
- This means the project's first piece of **native compiled code** (a small native Node addon or a companion helper executable), which adds real build-pipeline complexity (matching Node/Electron ABI, cross-checking in CI) — a bigger step than anything built so far.
- Safe/reversible by construction: Ctrl+Alt+Del can never be intercepted by any user-mode hook (Windows enforces this), so it always remains an absolute escape hatch alongside a physical reboot. The hook only exists while the Anchoran process is alive; if it crashes or is closed, Windows automatically reclaims the keys — no lingering broken state, nothing touched at the OS/login/boot level.
- Real-world caveat to plan for: a global keyboard hook is a classic pattern antivirus/SmartScreen heuristics flag — likely needs code signing to avoid false-positive warnings on install/first run.
- **Carry the existing fullscreen boot/shutdown/update theater into this launch mode too** — it should look and feel like the same cinematic fullscreen experience Anchoran already has, not a separate stripped-down mode.
- **Revisit the "must fully quit to self-update" limitation in this context.** Today, an NSIS silent update requires the whole Electron process to exit before it can overwrite its own files, producing a real gap with nothing Anchoran-side able to render (documented, understood, not something to fake around). In "secondary OS" mode this deserves a fresh look — e.g. whether the update could be staged and swapped in without ever dropping back to bare Windows mid-session, or whether the existing pre-quit theater + "Finishing update…" boot messaging is still the right answer here too.

Not started. Needs its own dedicated design + implementation pass before writing any native code, given the scope and the native-compilation step it introduces to the build.
