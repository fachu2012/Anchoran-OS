# Changelog

All notable changes to Anchoran OS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).

## [1.2.1] - 2026-09-11

### Changed

- Boot screen is now a properly staged, slower sequence (~6.5s):
  black screen first, then the icon alone, then the wordmark, then a
  thick macOS-style loading bar (8px, rounded) that fills over ~3.6s
  with cycling status text — instead of everything appearing at once.

## [1.2.0] - 2026-09-11

### Added

- **Fullscreen "update ready" screen**, same visual language as boot/
  shutdown: when a background update check (startup, `anchoran update`,
  or Settings → About) finishes downloading, Anchoran shows "Anchoran OS
  vX.Y.Z is ready to install" with Restart & Update / Later, instead of
  only a line of text in Settings. Choosing to update plays the same
  staged shutdown-style animation before restarting.
- **Update history**: Anchoran now remembers every version it's been
  updated from/to and when, shown in Settings → About. This is detected
  by comparing the running version to the last one recorded on every
  boot, independent of *how* the update happened.
- GitHub Releases now include a link to `CHANGELOG.md` in their
  description.

### Changed

- This update screen is implemented natively inside Anchoran OS itself
  (reusing the same boot/shutdown components), not by relaunching the
  separate `AnchoranSetup.exe` — that keeps updates from re-downloading
  the ~150MB fullscreen installer app on every version bump, at the cost
  of the update screen and the first-install screen being two separate
  (matching-style) implementations rather than one.

## [1.1.0] - 2026-09-11

### Added

- **Cinematic boot screen**: staged, determinate progress (not a generic
  shimmer) with cycling status lines ("Starting Anchoran OS…" → "Loading
  desktop environment…" → "Preparing your workspace…" → "Almost there…")
  over ~3.5s instead of an instant flash of the logo.
- **Cinematic shutdown/restart/sleep screen**: same treatment — staged
  status lines and a filling progress bar during the hold before the
  screen fades to black.
- **CI now also builds and publishes `AnchoranSetup.exe`** (the
  fullscreen branded installer), not just AnchoranOS's own NSIS wizard —
  that's the one end users should actually download from Releases.

### Fixed

- The GitHub Release workflow failed in two different ways while getting
  this working, both now fixed: `electron-builder` was trying to
  self-publish during the build step without a token present (`--publish
  never` added), and the workflow's default `GITHUB_TOKEN` lacked write
  permission to create/attach to a Release (`permissions: contents:
  write` added).
- `latest.yml` (what `electron-updater` reads to find updates) referenced
  a filename that didn't match the actual built `.exe` — pinned
  `artifactName` in `electron-builder.yml` so they always match.

## [1.0.0] - 2026-09-11

Promoted out of the `alpha.N` pre-release track and onto the strict
`MAJOR.MINOR.PATCH` versioning the project rules call for from here on.
This is the same build as `1.0.0-alpha.6` below — nothing functional
changed, only the version number — kept as the baseline going forward.
See the `alpha.1`–`alpha.6` entries for the full history of what shipped
to get here.

## [1.0.0-alpha.6] - 2026-09-11

### Fixed

- **Auto-update would have silently never found anything**: `latest.yml`
  (the file electron-updater reads from a GitHub Release to know the
  current version/download URL) referenced a sanitized, space-free
  filename that didn't match the actual `.exe` electron-builder produced
  locally ("Anchoran OS Setup …" vs. "Anchoran-OS-Setup-…"). Pinned
  `artifactName` in `electron-builder.yml` so the built file's name always
  matches what's inside `latest.yml`.
- `.github/workflows/release.yml` now also attaches `latest.yml` and the
  `.blockmap` file to the GitHub Release, not just the `.exe` — without
  `latest.yml` specifically, the update check has nothing to read
  regardless of what's attached.

## [1.0.0-alpha.5] - 2026-09-11

### Added

- **Auto-update is now real**, not a stub: `electron-builder.yml` publishes
  to `fachu2012/Anchoran-OS` on GitHub, Anchoran checks on startup, and both
  `anchoran update` in the Terminal and Settings → About → "Check for
  updates" trigger a live check with real state (checking / downloading N% /
  up to date / ready to install) instead of a canned message. Installing a
  downloaded update happens via an explicit "Restart & install" action, not
  silently.
- `.github/workflows/release.yml` is what actually publishes the Releases
  this reads from — pushing a `vX.Y.Z` tag is what makes an update exist to
  find.

## [1.0.0-alpha.4] - 2026-09-11

### Changed

- **Unified the desktop chrome into a single floating taskbar at the
  bottom** (Launcher, pinned + running apps, notifications, network,
  volume, battery, clock, power), replacing the separate top system bar
  and bottom dock.
- Window maximize/snap now reserves space for the bottom taskbar instead
  of a top bar.
- Notification toasts/panel repositioned to match (panel now opens
  upward from the taskbar's notification icon).
- Settings: every section that was a placeholder now has real controls
  (see Added).

### Added

- **Battery and network status are now real**, read via the Battery
  Status API and `navigator.onLine` and shown in the taskbar tray
  (percentage + charging state where the host exposes a battery).
- **Lock screen PIN**: an optional PIN (Settings → Users) that the lock
  screen requires before unlocking, with a dot-entry pad and a shake on
  a wrong attempt. No PIN set keeps the previous "any input unlocks"
  behavior.
- **Do Not Disturb**: silences toasts/sounds while still logging
  notifications to history (Settings → Notifications and the
  notification panel itself).
- **Backup / restore / reset** (Settings → Privacy): export Anchoran's
  preferences + virtual filesystem to a JSON file, import one back, or
  wipe everything and start fresh — all through native file dialogs.
- **Files**: a real Trash (delete is now reversible — restore or empty
  permanently), a list view alongside the grid, and search across the
  whole filesystem.
- **Sound settings** (Settings → Sound): enable/disable system sounds
  and control their volume.
- Settings → System now shows real CPU/RAM/platform info; Settings →
  About has a "Check for updates" action.
- Notification panel now groups consecutive notifications from the same
  source with a count instead of listing every one individually.
- Apps are now lazy-loaded — Anchoran's initial bundle only ships the
  desktop shell; each app's code loads the first time its window opens.

### Known decision — Windows key

Explicitly revisited and **not changed**: Anchoran still cannot reliably
make the bare Windows key open its own Launcher instead of the Windows
Start Menu. The only way to actually win that race is a native,
system-wide low-level keyboard hook (`SetWindowsHookEx` with event
suppression) — genuinely more invasive than anything else in this
project, cannot be verified in this build environment (no way to press
a physical Windows key here), and risky to ship unverified (a
misbehaving low-level hook can affect the whole Windows session, not
just Anchoran). `Ctrl+Space` remains the reliable way to open the
Launcher by keyboard.

## [1.0.0-alpha.3] - 2026-09-11

A large batch covering visual identity, window management, real system
data, on-disk persistence, and project infrastructure.

### Added

- **Real Anchoran logo** (`assets/logo/anchoran-logo.svg`): a geometric mark
  built from a ring, a stem, a crossbar and one continuous curve — the anchor
  is present only as an underlying proportion, not as literal nautical
  iconography. The executable icon is now derived from it (previously a
  blank placeholder).
- **On-disk persistence**: preferences, the virtual filesystem, remembered
  window bounds, and the "welcomed" flag now live in Anchoran's own on-disk
  stores (`electron-store`, under the app's `config/`/`data/` folders),
  replacing `localStorage`. Falls back to `localStorage` automatically when
  the renderer runs outside Electron (e.g. a plain browser preview).
- **Real system info** in System Monitor: actual CPU model/usage and
  RAM (via Node's `os` module over IPC), not just renderer memory.
- **WindowManager**: snap-to-edge (drag to the left/right/top of the screen),
  resize from all 4 edges and all 4 corners (previously bottom-right only),
  per-app remembered size/position across sessions, and a `Ctrl+Tab` /
  `Ctrl+Shift+Tab` window switcher.
- **Basic multi-monitor support**: Settings → Display lists connected
  monitors and can move Anchoran to a different one.
- **Browser app** now uses Electron's `<webview>` instead of `<iframe>`, so
  sites that block framing (`X-Frame-Options`/CSP) load correctly.
- **Terminal**: command history via ↑/↓.
- **Notes**: rewritten as a multi-document app (a document list + editor),
  backed by Anchoran's virtual filesystem, instead of a single scratch note.
- **Files**: drag-and-drop — reorder/move items between folders, and import
  real files dragged in from Windows Explorer (text-based files import their
  content; binary files are added as empty placeholder entries, a documented
  limitation).
- **System sounds**: short, synthesized tones (Web Audio API, no audio
  files) for login and notifications, plus an error tone wired into the new
  crash safety net.
- **Crash safety net**: a React error boundary plus global
  error/unhandledrejection handlers, all logging to Anchoran's own
  `logs/anchoran.log` instead of silently blanking a window.
- **Automated tests** (Vitest): WindowManager and virtual filesystem store
  logic, 13 tests.
- **CI/CD** (GitHub Actions): typecheck+test+build on every push/PR, and a
  tag-triggered release workflow that builds and attaches `AnchoranOS.exe`.
- **Auto-update** wiring (`electron-updater`) — inert until a GitHub
  `publish` target is filled in in `electron-builder.yml`.
- **`AnchoranSetup.exe`**: the custom fullscreen branded installer (MVP) —
  see the README section for how it works and its known caveats.
- Two more code-generated wallpapers (Ember, Verdant).

### Changed

- Default theme is now **Dark** (was Light); reworked color tokens for a
  richer, more premium palette in both themes.
- Self-hosted the Inter variable font instead of the system font stack.
- More motion throughout: window open/close/minimize, dock, system bar,
  launcher, power menu, context menu, notifications, boot and shutdown
  screens all now animate in/out.
- **Boot and shutdown/restart/sleep now have dedicated transition screens**
  instead of an instant cut — Anchoran fades through a branded screen with
  the logo and a status line before/after the actual state change.

## [1.0.0-alpha.2] - 2026-09-11

### Changed

- **Dark mode is now the default theme** (light remains available in Settings → Appearance).
- Reworked the color system: richer near-black dark palette, refined light palette, new elevation/overlay/shadow tokens used consistently across windows, dock, system bar, launcher, power menu, context menu and notifications.
- Self-hosted the Inter variable font instead of relying on the system font stack, for a more consistent, professional look across machines.
- Default wallpaper is now a layered gradient (radial highlight + linear depth) instead of a flat gradient.

### Added

- Window open/close/minimize animations (the window now visibly scales/fades out instead of vanishing instantly).
- Entrance animations across the Launcher, Power menu, Exit confirmation, context menu, notification toasts/panel, system bar, and dock.
- Toasts now auto-dismiss after a few seconds (sliding out) while staying in the persistent Notification panel's history.
- `Ctrl+Space` global shortcut as a reliable fallback for opening the Launcher, alongside the best-effort Windows-key binding (see Known Limitations — the Windows key cannot be reliably owned by a normal Electron app on Windows).
- A running-windows strip in the system bar (Anchoran's task switcher), so minimized windows — including multiple Terminal/Notes instances — are always recoverable.
- Contextual notifications (app installed, welcome message on first boot) feeding the new notification history.
- Dedicated "Restart" icon, separate from the window "restore" icon.

## [1.0.0-alpha.1] - 2026-09-11

First pre-release build, meant for hands-on testing of the full desktop
experience end to end (boot → desktop → apps → lock/power → exit).

### Added

- Initial project scaffold: Electron + React + TypeScript + Vite.
- Core architecture: WindowManager, Desktop, Applications, Components, Theme, Settings, FileSystem, Terminal, Notifications, Assets.
- Fullscreen kiosk shell base (frameless, immersive window).
- Boot screen with Anchoran identity.
- Light/Dark theme system with configurable accent color.
- Centralized WindowManager: open/close/focus/minimize/maximize/move/resize, drag-to-move, drag-to-resize.
- Eight built-in applications: Files, Terminal, Settings, Notes, Calculator, Browser, System Monitor, App Center.
- Anchoran Launcher (search + open apps + Settings/Power), opened from the dock, system bar, or the Windows key where Electron can register it.
- Running-windows strip in the system bar acting as Anchoran's task switcher, including restoring minimized windows.
- Full notification system: toasts plus a persistent notification panel (history, dismiss, clear all).
- Lock screen and Power menu (Lock, Sleep, Restart Anchoran, Shut Down Anchoran), plus the "Exit Anchoran?" confirmation on any normal close attempt.
- Anchoran's own virtual filesystem (Files app + Terminal), fully separate from the host Windows filesystem.
- Single-source SemVer versioning (`version.json`) synced into build metadata, shown in Settings → About and `anchoran version`.
- Placeholder assets for the logo and executable icon pending final design; all other iconography and the default wallpaper are code-generated (no emojis, no raster placeholders needed).
- Reproducible build producing `AnchoranOS.exe` via `electron-builder` (NSIS).

### Known limitations in this pre-release

- The installer is currently electron-builder's default NSIS wizard, not the custom fullscreen branded installer planned for the 1.0.0 release (see README roadmap).
- The Browser app embeds sites via `<iframe>`; sites that block framing will show blank.
- The Anchoran logo is a placeholder; the executable icon is a blank placeholder `.ico`.
