# Anchoran OS

Anchoran OS is an immersive desktop shell that runs as a Windows application
(`AnchoranOS.exe`). It is not a real operating system, kernel, or bootloader —
it is a fullscreen, kiosk-style Electron application designed to feel like an
independent, professional desktop environment.

## Stack

- **Electron** — native Windows shell, fullscreen kiosk window, global
  shortcuts, packaging, on-disk persistence (`electron-store`), auto-update
  (`electron-updater`).
- **React + TypeScript** — the entire desktop UI.
- **Vite** — dev server / renderer bundler.
- **Zustand** — state (WindowManager, preferences, filesystem, notifications).
- **Vitest** — unit tests for the WindowManager and virtual filesystem stores.
- **electron-builder** — produces the final `AnchoranOS.exe` (NSIS installer).

## Project structure

```
electron/          Electron main process + preload (the host shell): fullscreen
                    window, on-disk stores, real system info, error logging,
                    global shortcuts, auto-update
installer/          AnchoranSetup — the branded fullscreen installer app (see
                    "Custom fullscreen installer" below); its own Electron app
src/
  core/             Version source-of-truth, shared types, Electron bridge
                    types, persistence helper, synthesized system sounds,
                    error boundary / crash safety net
  theme/            Light/Dark tokens, ThemeProvider, preferences store
  windowmanager/    Centralized WindowManager — open/close/focus/minimize/
                    maximize/move/resize (all 4 edges + corners), edge
                    snapping, per-app remembered bounds, Ctrl+Tab switcher
  desktop/          Wallpaper, system bar, dock, desktop icons, context menu,
                    running-windows strip (task switcher)
  launcher/         Anchoran Launcher (search + open apps + Settings/Power)
  applications/     Files, Terminal, Settings, Notes, Calculator, Browser,
                     System Monitor, App Center
  filesystem/       Anchoran's own virtual filesystem (never touches host
                    files by default; Files supports drag-and-drop import)
  notifications/    Notification store + toasts + persistent history panel
  boot/             Boot screen
  lock/             Lock screen
  power/            Power menu, "Exit Anchoran?" confirmation, shutdown/
                    restart/sleep transition screen
  components/       Shared UI primitives (Icon, etc.)
assets/
  logo/             Anchoran logo (anchoran-logo.svg)
  icons/            Reserved for non-code-generated icon assets
  wallpapers/       Reserved for photographic/illustrated wallpapers (current
                     wallpapers are code-generated gradients, see
                     src/desktop/wallpapers.ts)
  fonts/            Self-hosted Inter variable font
version.json        Single source of truth for Anchoran's SemVer version
CHANGELOG.md        Keep-a-Changelog formatted history
.github/workflows/  CI (typecheck+test+build) and tag-triggered release build
```

## Versioning

Anchoran uses strict [SemVer](https://semver.org/): `MAJOR.MINOR.PATCH`,
starting at `1.0.0`. The **only** file to hand-edit is `/version.json`.
`npm run sync-version` (run automatically before `dev`/`build`) propagates it
into both `package.json` and `installer/package.json`, which `electron-builder`
reads to stamp the version onto the built executables. The same value is read
at runtime by `src/core/version.ts` and shown in Settings → About, the boot
screen, and the `anchoran version` terminal command. Update `CHANGELOG.md`
alongside every version bump.

## Development

```bash
npm install
npm run dev
```

This starts the Vite dev server and an Electron window pointed at it,
fullscreen, frameless — the same shell used in production.

## Testing

```bash
npm run test
```

Runs the Vitest suite (WindowManager and virtual filesystem store logic).
`npm run typecheck` runs a full TypeScript check with no emit.

## Building `AnchoranOS.exe`

```bash
npm install
npm run dist
```

This will:

1. Sync `version.json` into `package.json`.
2. Build the React renderer (`vite build` → `dist/`).
3. Compile the Electron main/preload process (`tsc` → `dist-electron/`).
4. Run `electron-builder`, producing a Windows NSIS installer under
   `release/`.

## Custom fullscreen installer (`AnchoranSetup.exe`)

`installer/` is a second, small Electron app: a fullscreen, Anchoran-branded
installer experience, instead of showing users the default NSIS wizard.

```bash
npm run dist:full
```

runs, in order: `npm run dist` (builds AnchoranOS's own NSIS installer),
`prepare-installer-source` (copies that installer to a fixed filename), then
`installer`'s own `npm install` + `electron-builder` build, producing
`AnchoranSetup.exe` under `release-setup/`. **`AnchoranSetup.exe` is the one
executable meant to be distributed to end users.**

How it works: AnchoranSetup bundles AnchoranOS's real NSIS installer and runs
it silently (`/S`) in the background while showing a fullscreen progress
screen (Preparing → Copying → Configuring → Done) with Anchoran's logo and
palette; on success it launches `AnchoranOS.exe` and closes itself.

**Known caveats (MVP, not yet hardened):**
- NSIS's silent mode doesn't report real byte-level progress, so the stage
  list is a timed animation rather than a literal progress readout — the
  same trade-off most branded installer wrappers around a silent
  NSIS/MSI payload make.
- After a silent install, AnchoranSetup guesses the installed
  `AnchoranOS.exe` path (`%LOCALAPPDATA%\Programs\Anchoran OS\`) to
  auto-launch it; if that guess is wrong (e.g. a non-default install
  location) it falls back to telling the user to launch Anchoran OS from
  the Start Menu instead of crashing.
- The installer's copy of the logo (`installer/renderer/logo.svg`) is a
  manual duplicate of `assets/logo/anchoran-logo.svg` for packaging
  simplicity — update both if the logo changes.
- This chain has been typechecked and compiled, but **not smoke-tested
  end-to-end** (installing, launching) in this environment — see
  "Known limitations" below for why.

## CI/CD

- `.github/workflows/ci.yml` — typecheck, test, and build on every push/PR to
  `main`.
- `.github/workflows/release.yml` — on pushing a `v*` tag (e.g. `v1.0.0`),
  builds `AnchoranOS.exe` and attaches it to a GitHub Release.
- Auto-update (`electron-updater`) is live: `electron-builder.yml`'s `publish`
  block points at `fachu2012/Anchoran-OS` on GitHub, Anchoran checks for
  updates on startup, and `anchoran update` in the Terminal (or Settings →
  About → "Check for updates") trigger a check on demand with real progress
  ("Downloading… N%", then "Restart & install"). It only actually finds an
  update once `.github/workflows/release.yml` has published a GitHub Release
  — tagged `vX.Y.Z` — for a version newer than what's installed; until a tag
  is pushed there's simply nothing to find, which is expected, not broken.
- Code signing is intentionally **not** set up — without it, Windows
  SmartScreen will show an "unknown publisher" warning on install. Signing
  needs a paid certificate, which is a business decision, not a technical
  one, so it's left for you to decide on.

## Known limitations (by design — see project security rules)

- **Windows key interception**: Anchoran attempts to register the bare
  Windows key as a global shortcut to open its Launcher, but Windows
  Explorer/the Start Menu itself owns that key at the shell level —
  `globalShortcut.register("Super", …)` often fails to register at all on
  Windows, and even when it succeeds, Windows may still win the race and
  open its own Start Menu. Electron's `globalShortcut` API — the only
  mechanism a normal, non-elevated app has — cannot reliably override this;
  doing so would require a native, system-wide low-level keyboard hook,
  which this project has intentionally not added yet. **`Ctrl+Alt+L` is
  registered as a reliable fallback** and always opens the Anchoran
  Launcher — a combination that doesn't touch the Windows key at all, so
  it avoids that whole class of OS-reserved collision (two earlier
  choices were dropped for exactly that reason: `Ctrl+Space` frequently
  collides with Windows' own input-method switch hotkey, and `Ctrl+Win` —
  despite not being the bare Windows key — turned out to still be claimed
  by Windows on some machines, e.g. for Ink Workspace/accessibility
  shortcuts). The Launcher is also always reachable from the dock and
  system bar. Anchoran never disables or intercepts Windows' own critical
  shortcuts (Ctrl+Alt+Del, Task Manager, sign-out, forced shutdown, or any
  recovery mechanism).
- **Not literal Alt+Tab**: for the same reason as the Windows key, Anchoran's
  window switcher is bound to `Ctrl+Tab` / `Ctrl+Shift+Tab` instead — Windows
  owns Alt+Tab at the shell level too.
- **No true kernel-level kiosk lock**: Anchoran cannot and does not attempt
  to prevent Windows from regaining control through its own emergency
  mechanisms. It creates a *convincing, immersive experience*, not a locked
  device.
- **Multi-monitor is partial**: Anchoran is still a single fullscreen window
  (not an independent desktop per display); Settings → Display lets you move
  that window to a different connected monitor, but you can't currently have
  Anchoran occupy two displays as one spanned desktop.
- **Files import is text-only**: dragging a file from Windows into Files
  imports its text content when the file looks text-based; binary files
  (images, PDFs, archives, etc.) are added as empty placeholder entries
  rather than silently dropped, since Anchoran's virtual filesystem only
  stores text content today.
- **This session's sandbox could not run the actual Electron GUI**
  (`ELECTRON_RUN_AS_NODE=1` is forced in this tool environment), so builds
  here were verified by typechecking, unit tests, and successful
  `electron-builder` packaging — not by visually running the app. Run
  `npm run dev` or the built `.exe` yourself to see it live.
