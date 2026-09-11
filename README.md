# Anchoran OS

Anchoran OS is an immersive desktop shell that runs as a Windows application
(`AnchoranOS.exe`). It is not a real operating system, kernel, or bootloader —
it is a fullscreen, kiosk-style Electron application designed to feel like an
independent, professional desktop environment.

## Stack

- **Electron** — native Windows shell, fullscreen kiosk window, global
  shortcuts, packaging.
- **React + TypeScript** — the entire desktop UI.
- **Vite** — dev server / renderer bundler.
- **Zustand** — state (WindowManager, preferences, filesystem, notifications).
- **electron-builder** — produces the final `AnchoranOS.exe` (NSIS installer).

## Project structure

```
electron/          Electron main process + preload (the host shell)
src/
  core/             Version source-of-truth, shared types, Electron bridge types
  theme/            Light/Dark tokens, ThemeProvider, preferences store
  windowmanager/    Centralized WindowManager (open/close/focus/move/resize/z-index)
  desktop/          Wallpaper, system bar, dock, desktop icons, context menu
  launcher/         Anchoran Launcher (search + open apps + Settings/Power)
  applications/     Files, Terminal, Settings, Notes, Calculator, Browser,
                     System Monitor, App Center
  filesystem/       Anchoran's own virtual filesystem (never touches host files)
  notifications/    Notification store + toast UI
  boot/             Boot screen
  lock/             Lock screen
  power/            Power menu + "Exit Anchoran?" confirmation
  components/       Shared UI primitives (Icon, etc.)
assets/
  logo/             Anchoran logo (placeholder until final design)
  icons/            Reserved for non-code-generated icon assets
  wallpapers/       Reserved for photographic/illustrated wallpapers
  fonts/            Reserved for a custom brand typeface, if adopted
version.json        Single source of truth for Anchoran's SemVer version
CHANGELOG.md        Keep-a-Changelog formatted history
```

## Versioning

Anchoran uses strict [SemVer](https://semver.org/): `MAJOR.MINOR.PATCH`,
starting at `1.0.0`. The **only** file to hand-edit is `/version.json`.
`npm run sync-version` (run automatically before `dev`/`build`) propagates it
into `package.json`, which `electron-builder` reads to stamp the version onto
`AnchoranOS.exe`. The same value is read at runtime by `src/core/version.ts`
and shown in Settings → About, the boot screen, and the `anchoran version`
terminal command. Update `CHANGELOG.md` alongside every version bump.

## Development

```bash
npm install
npm run dev
```

This starts the Vite dev server and an Electron window pointed at it,
fullscreen, frameless — the same shell used in production.

## Building `AnchoranOS.exe`

```bash
npm install
npm run dist
```

This will:

1. Sync `version.json` into `package.json`.
2. Build the React renderer (`vite build` → `dist/`).
3. Compile the Electron main/preload process (`tsc` → `dist-electron/`).
4. Run `electron-builder`, producing a Windows NSIS installer and
   `AnchoranOS.exe` under `release/`.

## Roadmap: custom fullscreen installer (planned for the 1.0.0 release build)

The release version must **not** ship with the default NSIS installer wizard
window. Decided architecture (to implement once the product is closer to
release, before Phase 29 / final build):

1. `AnchoranOS.exe` keeps being packaged via `electron-builder` (NSIS), but
   configured to install **silently** (`oneClick: true`, no UI of its own,
   `runAfterFinish: false`) — the user never sees this wizard.
2. A second, small Electron app, **`AnchoranSetup.exe`**, is built alongside
   it. It runs fullscreen/frameless exactly like Anchoran itself, carries the
   Anchoran logo/typography/palette, shows real install progress ("Preparing
   installation → Copying files → Configuring → Done") driven by the actual
   silent installer running behind it, and on completion launches
   `AnchoranOS.exe` and closes itself.
3. `AnchoranSetup.exe` is the only executable end users download and run —
   the real NSIS install happens invisibly behind this branded experience.

This needs its own `package.json`/build target (a second Electron app in the
repo, e.g. `installer/`), so it will be scaffolded as its own phase rather
than folded into Anchoran's own build — tracked here so the decision isn't
lost between sessions.

## Known limitations (by design — see project security rules)

- **Windows key interception**: Anchoran registers the Windows key as a
  global shortcut to open its Launcher. This is a best-effort OS-level
  affordance, not a lock — Windows and the user always retain control
  (Ctrl+Alt+Del, Task Manager, sign-out, forced shutdown, and all recovery
  mechanisms are never touched or disabled by Anchoran).
- **No true kernel-level kiosk lock**: Anchoran cannot and does not attempt
  to prevent Windows from regaining control through its own emergency
  mechanisms. It creates a *convincing, immersive experience*, not a locked
  device.
- **Browser app**: embeds external sites via `<iframe>`. Many sites block
  being framed (`X-Frame-Options` / CSP), which will show a blank page for
  those sites. A production-grade browser would need a dedicated
  `BrowserWindow`/`<webview>` strategy — left for a later phase pending your
  direction.
