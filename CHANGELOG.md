# Changelog

All notable changes to Anchoran OS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).

## [2.6.16] - 2026-09-12

### Fixed

- Window embedding was failing with "No window appeared… within 15s"
  for real apps that had actually opened a real window — the native
  helper was using .NET's `Process.MainWindowHandle`, which only finds
  a window matching a narrow heuristic (first visible top-level window
  with a non-empty title at that exact moment) that plenty of real
  apps, games especially, never satisfy. Replaced with a direct
  EnumWindows scan filtered by the launched process's id, which finds
  its window regardless of title or exact timing.

## [2.6.15] - 2026-09-12

### Fixed

- Embedding an external app could get stuck on "Starting…" forever
  with no explanation if the native helper died without reporting
  anything first — which real games readily trigger, since a lot of
  anti-cheat software kills any process that touches their window via
  SetParent/SetWindowLong. Now surfaces a real error either way: main
  process reports an unexpected helper exit, and the window itself
  gives up with a clear message after 20s regardless.

## [2.6.14] - 2026-09-12

### Added

- Real external Windows apps can now open embedded inside an Anchoran
  window instead of floating separately on the desktop: right-click
  any .exe in Files → "Run embedded in Anchoran (experimental)", or
  open the new "Windows App Window" app from the Webstore and pick one.
  Built on a new native helper (native/windowembed) that launches the
  app and reparents its real window via SetParent, keeping it
  positioned over the matching Anchoran window as it moves, resizes,
  minimizes, or gets focused/closed. Marked experimental on purpose:
  the embedded window is a real Win32 window compositing on top of the
  whole screen, so it will always render above every other Anchoran UI
  element in the space it occupies (other dragged windows, menus, …) —
  an inherent limit of mixing a real window with Anchoran's own
  GPU-composited UI, not something fixable without a full compositor.

### Fixed

- Terminal now also refocuses its input whenever its window becomes
  the focused one (clicking its taskbar icon, Ctrl+Tab, …) — the
  window store's own "focused" state is just app bookkeeping and
  doesn't move real keyboard focus by itself, which could leave a
  Terminal window with no visible cursor and no way to type until it
  was closed and reopened.

## [2.6.13] - 2026-09-12

### Fixed

- Terminal: added an explicit focus-on-mount fallback alongside the
  input's own `autoFocus`, for the case where `autoFocus` silently
  fails to actually move keyboard focus in a window that's mid-open-
  animation or otherwise not fully laid out the instant React applies
  it — previously that left every keystroke going nowhere with no
  visible error until the window was closed and reopened.

### Added (in progress)

- Early groundwork for embedding real external Windows apps inside an
  Anchoran window: a new native helper (native/windowembed, alongside
  the existing native/kioskhook) that launches an app and reparents
  its window via SetParent, driven by a line-based stdin/stdout
  protocol. Not wired into any UI yet — no way to trigger it from
  Anchoran in this release.

### Fixed

- Found the real cause of an update sometimes installing with no
  cinematic at all: electron-updater's `autoInstallOnAppQuit` defaults
  to true, which silently runs the installer on ANY app quit once an
  update has downloaded — closing Anchoran normally, Alt+F4, anything
  — completely outside Anchoran's own UI, regardless of the "Later" /
  "Restart & install" fixes already shipped. Now disabled; the only
  way an update installs is the explicit path that always shows
  UpdateTheater first.

## [2.6.11] - 2026-09-12

### Security

- Removed the Terminal's secret `sudo` command — it granted a full
  Administrator Terminal instantly with no authentication at all,
  which defeated the whole point of the PIN-gated "Run as
  Administrator" flow added earlier. The only way into an
  Administrator Terminal now is that PIN check.

### Changed

- Settings → Users no longer has a "Switch to" button on other
  profiles — switching between profiles now only happens from the
  lock screen, not from inside a session.

## [2.6.10] - 2026-09-12

### Changed

- Files, and the Import/Export/Save picker, now default to "Newest
  first" instead of alphabetical — matches what you're usually looking
  for right after saving or downloading something.

### Fixed

- Anchoran OS now enforces a single running instance — launching it
  again (double-clicking its shortcut repeatedly, opening it while
  it's already running, …) used to stack a brand new fullscreen window
  on top of the existing one; now it just brings the one real window
  to the front instead.

## [2.6.9] - 2026-09-12

### Fixed

- Terminal: a live download's progress (`anchoran update`, `anchoran
  changeto`) now rewrites a single line in place as the percent ticks
  up, instead of printing a brand new line for every update and
  flooding the scrollback.
- Settings → About's "Restart & install vX" button now opens the same
  fullscreen update cinematic every other update path uses, instead of
  silently installing and restarting in place — this was the gap that
  let an update slip past the cinematic: check for updates, click
  "Later" on the prompt that follows, then use that button instead.

## [2.6.8] - 2026-09-12

### Added

- Task View: a new taskbar button next to the Launcher shows every
  open window as a card (icon, title, a Close button) you can click to
  jump straight to it — the "see everything open at once" complement
  to Ctrl+Tab's one-at-a-time cycling.

### Fixed

- Terminal output text can now actually be selected and copied with
  Ctrl+C. Two separate bugs blocked it: a global `user-select: none`
  meant to stop accidental UI text selection also applied to the
  terminal's own output lines, and clicking anywhere in the terminal
  immediately refocused the hidden input, stealing focus back the
  instant a selection drag ended — so Ctrl+C copied the empty input
  instead of the text you'd just selected.

## [2.6.7] - 2026-09-12

### Added

- `anchoran changeto [vX.Y.Z]` in the Administrator Terminal is now
  actually wired up: listed alone it shows every installable release,
  and given a version it asks "Change to vX.Y.Z? [y/n]" and, on yes,
  downloads that release's installer and runs it silently — works for
  upgrading OR downgrading to any past installable release, not just
  the newest one. Moved out from being its own bare command to live
  under the `anchoran` namespace, matching every other Anchoran-
  specific command.

### Fixed

- Magnifier: "Start magnifier" no longer fails forever after a single
  failed attempt — it was reusing one `<video>` element for the app's
  whole lifetime, and once that element's source errors it stays
  broken until reloaded, so one bad first attempt made every later
  click fail too. Each attempt now gets a fresh element (matching how
  Screenshot already did it), and a failure now shows the real
  underlying error instead of a generic message.

## [2.6.6] - 2026-09-12

### Fixed

- Right-clicking an app in the Launcher no longer also opens the
  desktop's own context menu (change wallpaper, refresh, …) behind it.
- Every context menu now stays fully on-screen — it flips upward if it
  would run off the bottom edge, and left/right if it would run off
  either side, instead of getting clipped.
- Files' Properties dialog "Type" row no longer says "File" for every
  single file — it now reads "Image" for photos, "Multimedia" for
  audio/video, and a specific label for documents, archives, code,
  and everything else Anchoran already recognizes by extension; its
  icon matches the file's real type and color too.
- Color Picker can now sample a color from anywhere on screen (not
  just its own color wheel), via a new "Pick from screen" button.
- Removed the accent-colored keyboard-focus ring from text fields —
  clicking into an input no longer outlines the whole box; the accent
  border stays reserved for the focused app window.

### Changed

- Removed the boxed background/border around the Anchoran logo on the
  Boot and Shutdown screens and enlarged the logo itself to fill the
  space instead.
- The taskbar's Launcher button now shows the actual Anchoran logo, in
  the user's configured accent color, instead of a plain hamburger icon.

## [2.6.5] - 2026-09-12

### Changed

- Launcher: browsing all apps (no search query) now groups them by
  first letter, Windows-10-style — click any letter header to open a
  full A–Z jump grid and scroll straight to that section. Searching
  still shows a plain flat list of matches, as before.
- Launcher: removed the per-row "pin to taskbar" / "add to desktop"
  buttons; right-clicking an app now opens a context menu with Open,
  Pin/Unpin taskbar, Add/Remove desktop, Run as Administrator (only
  for apps that support it), and Uninstall (only for apps that aren't
  installed by default).
- Uninstalling an app — from the Launcher, the Webstore, or anywhere
  else — now always unpins it from the taskbar and removes it from
  the desktop too, instead of leaving a shortcut to an app that's no
  longer installed.

## [2.6.4] - 2026-09-12

### Added

- The Launcher's per-app row now has an "Add to desktop" pin button
  next to "Pin to taskbar" — any installed app can be pinned to the
  desktop, not just the handful pinned there by default.
- Every app icon and every file-type icon now sits on its own solid
  color tile instead of rendering as plain white line art, so apps
  and files are recognizable by color at a glance: file types use
  real-world conventions (folders amber, PDFs red, zips orange, images
  purple, video pink, audio green, code teal, …), and every other app
  icon gets a color derived from its own name so it's stable and
  distinct from its neighbors. Applied across the taskbar, desktop
  icons, the Launcher, the Webstore, and Files' grid/list views.

## [2.6.3] - 2026-09-12

### Added

- Profile permissions: the first user ever created on this PC becomes
  its permanent owner admin (this can never be revoked); creating a
  new profile now asks whether it should be an administrator, and only
  the owner can grant or revoke admin status on other profiles
  afterwards — from Settings → Users, which now only lets each profile
  edit its own details.
- Terminal / desktop icon right-click menu: "Run as Administrator" —
  prompts for the PIN of any admin profile on this PC and, once
  verified, opens a new Administrator Terminal window.

## [2.6.2] - 2026-09-12

### Added

- Administrator Terminal: `crashinfo` — the last crash recorded in
  Anchoran's own log, the one item missing from its full command list.

## [2.6.1] - 2026-09-12

### Fixed

- **The Onboarding progress dots ignored your accent color** — hardcoded
  to a fixed blue instead of reading `--anchoran-accent` like
  everything else in the OS.

### Added

- A visible accent-colored border on the focused window, a bigger and
  more visible taskbar "open" indicator (a pill when focused), a
  stronger taskbar divider, and an Enter-key hint on the Launcher's
  top result.
- Context menus can now carry an icon per item (opt-in, existing menus
  are unaffected).
- Files shows how much space is left on the current drive next to the
  address bar.
- A shared "nothing here yet" empty-state component, used in Event
  Viewer and Todo.
- A bigger logo in Onboarding, its card widened, and its progress
  dots are now a proper pill when active. A bigger logo in Settings'
  About section too.

## [2.6.0] - 2026-09-12

### Added

Every command from both pending Terminal wishlists is now real:

- **Normal Terminal**: `anchoran changelog [vX.Y.Z]`, `anchoran uptime`
  (this session), `anchoran restart`, `anchoran lock`, `anchoran apps`,
  `anchoran install/uninstall <app>`, `anchoran open <app>`,
  `anchoran kill <app>`, and `history`.
- **Administrator Terminal**: `shutdown`, `restart`, `sleep`,
  `resetpin --confirm`, `listprofiles`, `delprofile <id>`,
  `regquery <key>` (read-only), `du <folder>`, `netcheck`,
  `ping <host>`, `myip`, `exportlogs`, `listwindows`,
  `closewindow <id>`, `resetlayout`, and `restartexplorer` (the same
  real recovery step as Task Manager's own "Restart" on
  explorer.exe). `killexplorer`, `format`, and `deleteallfiles` exist
  as commands but refuse on purpose — the risk of leaving the real
  desktop broken, or destroying real files with no way back, isn't
  worth it for a command typed into a terminal with no second
  confirmation surface.

## [2.5.2] - 2026-09-12

### Fixed

- **Notification toasts could end up never auto-hiding**: each toast's
  6-second countdown was tied to the whole notification list's length,
  so every new notification arriving reset the timer on every toast
  already on screen — a steady stream of notifications meant none of
  them ever disappeared on their own. Each toast now counts down
  independently from when it actually appeared.

## [2.5.1] - 2026-09-12

### Added

- Custom scrollbars across the whole OS instead of the browser
  default, and visible focus rings for real keyboard navigation
  (absent on a plain mouse click, same as any modern OS).
- Context menus now support separators and a "danger" (red) style for
  destructive actions — Files' "Delete" uses it now, with a separator
  before it.

## [2.5.0] - 2026-09-12

### Fixed

- **A real keyboard-focus leak on the Lock Screen**: the Windows key,
  Ctrl+Alt+L, and Alt+Tab still worked while locked and opened the
  Launcher (or switched focus) behind the lock screen — invisible, but
  real, so the next keys you typed for your PIN could silently go into
  the hidden Launcher's search box instead. The lock screen now blocks
  every keystroke not aimed at itself while it's up, and Space now
  also opens the PIN entry (not just a click).
- **`ContextMenu` leaked a `keydown` listener on `window` on every
  open** — it was never removed, so opening a lot of right-click menus
  over a session quietly stacked up duplicate Escape handlers.
- **A real design bug**: `data-op="true"` (the "this tab/toggle is
  active" state) had no CSS at all for `.app-toolbar-btn`, so the
  active state was invisible in 12+ apps (Clock, Calculator, System
  Monitor, Event Viewer, Converter, Todo, Pomodoro, Sudoku, Paint,
  Pixel Art, Wallpaper Maker, Browser, Magnifier, Files, Settings).

### Changed

- **Boot and Shutdown screens redesigned**: bigger logo and loading
  bar on both, the logo now sits in a real solid tile instead of
  floating on a transparent background, the Boot screen's "ANCHORAN
  OS" wordmark is gone, and the Shutdown screen now shows only the
  icon and the bar — no more status text.
- Buttons across the OS now have a real `:active` press state, a real
  `:disabled` look, and visible focus rings.

### Added

- **The Administrator Terminal**: type `sudo` in the normal Terminal
  to unlock it for that window — real admin commands (`ps`,
  `taskkill`, `startup`, `systemmode`, `df`, `emptyrecyclebin`,
  `clearcache`, `backup`/`restore`, `wipe --confirm`, `theme`,
  `wallpaper`, `accent`, `scale`, `logs`, `changeto`, and more) wired
  to real, already-existing capabilities, not fake ones. Anchoran's
  crash screen now also embeds a live Administrator Terminal directly
  (no window chrome — it isn't a real window), so there's a real way
  to poke at processes, logs, and disk usage even when the desktop
  itself has crashed.

## [2.4.0] - 2026-09-12

### Added

A major rebuild of the Browser app, real tabs and all:

- **Tabs**: new/close/duplicate/close others/close tabs to the right/
  reopen the last closed tab, plus a dedicated incognito tab (its own
  throwaway session — no history or bookmarks recorded).
- **Real navigation**: back/forward/reload with a loading spinner and
  favicon per tab.
- **Address bar**: typing a bare word searches the web, a domain goes
  straight there, and it autocompletes from your own history and
  bookmarks as you type.
- **Bookmarks and History**: a star to bookmark the current page, and
  panels to browse, search, and clear either — reusing Anchoran's own
  shared data store like every other app.
- **Downloads**: a real downloads panel with live progress, and a
  notification when one finishes — downloads still land straight in
  your real Downloads folder.
- **Find in page** (Ctrl+F), **zoom** (Ctrl +/−/0), **print**, and
  **save the current page as a real PDF**.
- **New Tab page** with a search box, your top bookmarks, and (if
  you've searched a city in the Weather app before) a small current-
  temperature widget.
- **Popups open as a new tab** instead of a separate window — the
  practical way this browser avoids intrusive popups.
- **A basic ad/tracker block** (a short list of common ad/analytics
  domains) toggleable from the toolbar, and a per-page **forced dark
  mode** toggle.
- **Right-click on an image** now offers "Set as Wallpaper" and "Save
  Image As…", both going through Anchoran's own picker, no Windows
  dialog involved.
- **Clear browsing data** (cookies/cache) from the status bar.
- Camera/microphone/location permission requests are denied by
  default instead of silently hanging.

Some of what was discussed didn't make this pass — a few conflict with
how Anchoran is built (an always-on-top tab isn't meaningful in a
single fullscreen shell window; the browser's own UI zoom is already
covered by Settings → Display → Interface scale; per-profile bookmarks
would break the existing rule that app data is shared across
profiles), and a few need infrastructure this build doesn't have yet
(live search suggestions, reader mode, page translation, a true
extension system, drag-to-reorder tabs, tab groups, and a real
full-page — not just viewport — screenshot).

## [2.3.0] - 2026-09-12

### Fixed

- **Magnifier only followed the mouse while it was over the
  Magnifier's own window** — it now tracks the real cursor anywhere on
  the desktop, the way a real magnifier lens does.
- **Screen Recorder**: codec selection now falls back if vp9 isn't
  actually encodable on this machine, resolution/frame-rate are
  explicit instead of left to Chromium's default, a real `onerror`
  handler surfaces encoder failures instead of failing silently, and
  an empty recording is now reported as an error instead of saving a
  broken file.
- **Screenshot's own window used to appear inside every screenshot**
  (PrintScreen included) — it's now hidden for the moment of capture
  and restored right after.

### Added

- **Screenshot**: drag-to-select a region instead of only full-screen
  capture, and a "Copy" button that puts the image straight on the
  clipboard.
- **Files**: a real Properties dialog (size — recursive for folders —
  location, created/modified dates), and an "Include subfolders" search
  toggle for finding a file without knowing which folder it's in.
- **Terminal**: `del`/`rm`, `move`/`mv`, `copy`/`cp`, `find`, and Tab
  completion for file and folder names.
- **Settings**: choose which app Files opens each file type with
  (Photo Viewer/Notes/Media Player/Quick Look, or the real Windows
  default app), and a "Find a setting" search box.
- **System Monitor**: a rolling history graph under CPU and memory
  usage instead of only the instantaneous value.
- **Event Viewer**: an "Errors only" filter and an "Export…" button
  that saves the current log to a real text file.
- **Storage Usage**: a "Quick cleanup" section to empty the Recycle
  Bin or clear Anchoran's own cache in one click.
- **Startup Apps**: flags entries whose target program no longer
  exists on disk.
- **Photo Viewer**: rotate and "Set as wallpaper" from the full-size
  view.
- **Media Player**: a play-next queue — add tracks to "Up next" and
  they play automatically once the current one ends.
- **Zip Tool**: add a file or folder into an existing .zip, not just
  export a whole folder or import a whole archive.
- **Calculator**: memory (MC/MR/M+/M−) and a clickable history of
  recent calculations.

## [2.2.2] - 2026-09-12

### Fixed

- **A real crash**: opening the Browser or Chat app could throw a
  synchronous error from Electron's `<webview>` (`setAudioMuted`
  called before its guest page was actually ready), taking down the
  whole desktop to Anchoran's crash screen. Now caught and retried once
  the page is ready.

### Changed

- **The crash screen's recovery button now closes Anchoran entirely**
  ("Return to Windows") instead of trying to resume — a crash that
  deep can leave the desktop in an unreliable state, so ending the
  task cleanly is the safer outcome.

## [2.2.1] - 2026-09-12

### Changed

- **Double-clicking (or "Open") a file in Files now opens it with
  Anchoran's own default app for that type** — images in Photo Viewer,
  text in Notes, audio/video in Media Player, .zip contents in Quick
  Look — instead of a limited preview inside Files itself. Anything
  Anchoran has no app for now opens with its real Windows default app,
  the same as double-clicking it in Explorer would.
- The GitHub release description is now generated automatically from
  each version's own CHANGELOG.md section, so new releases stop
  showing the old generic installer boilerplate.

## [2.2.0] - 2026-09-12

### Changed

- **Importing, opening and saving files anywhere in Anchoran now uses
  Anchoran's own Files-style picker instead of Windows' native dialogs**
  — profile picture and wallpaper import (onboarding and Settings),
  Media Player's import, Notes' Open/Save As, and Zip Tool's
  import/export folder pickers. "Import from Windows…" is now just
  "Import…" everywhere it appears.

### Fixed

- **Chess was missing castling and en passant** — both are real legal
  moves in chess; without them the game could (rarely) declare
  checkmate or stalemate when a real player still had a way out.
- **Habit Tracker and Reminders used UTC instead of your local date**
  to decide what "today" is, which could mark/unmark the wrong day or
  mis-fire a reminder near midnight in timezones offset from UTC.
- **Terminal's `cd ..` from a top-level folder** (e.g. `C:\Users`)
  produced `C:` instead of `C:\`, which Windows can treat as "current
  directory on C:" rather than the actual drive root.
- **Notes' "New" and "Open…" discarded unsaved changes with no
  warning** — now asks for confirmation first.
- **QR Code showed a blank box with no explanation** if the QR image
  failed to load (e.g. offline) — now shows an actual error.
- **Quick Look's .zip file sizes relied on an undocumented internal
  JSZip field** that could silently break or read as 0 KB — now reads
  the real bytes through JSZip's public API.
- **Solitaire had no way to deselect a selected card** short of
  starting an unrelated move — clicking it again now cancels the
  selection.

## [2.1.13] - 2026-09-12

### Added

- **Copy everything from a minute in Event Viewer** — events are now
  grouped by the minute they happened in, and each group has a "Copy
  minute" button that copies every event from that minute to the
  clipboard at once.

### Fixed

- **Right-clicking inside an app window or the taskbar/dock opened the
  desktop's own context menu on top of (or instead of) the right one**
  — a right-click with nowhere else to go bubbled all the way up to the
  desktop background's handler. It now only opens for the desktop
  background itself.

## [2.1.12] - 2026-09-12

### Fixed

- **"Open with…" still did nothing in 2.1.11** — the `rundll32`/
  `shell32.dll,OpenAs_RunDLL` trick never actually worked. Replaced with
  the real `OpenWith.exe` (the same dialog Windows Explorer itself
  opens), and it now reports a real error instead of silently doing
  nothing if it ever fails again.

### Added

Ten features that a real OS ships with by default, now built in:

- **Recycle Bin** — a real desktop icon that opens Windows' actual
  Recycle Bin folder.
- **Unified search** in the Launcher — search apps, Settings sections,
  and real files (Desktop/Documents/Downloads/Pictures) from one box.
- **Screenshot shortcut** — PrintScreen and Ctrl+Shift+S now open
  Screenshot and start capturing immediately, system-wide.
- **Compress/Extract in Files** — "Compress to .zip" on any
  selection, and "Extract here" on any .zip file, right from the
  right-click menu.
- **On-Screen Keyboard** and **Narrator** — launch Windows' own
  `osk.exe`/`narrator.exe`.
- **Emoji Picker** — a click-to-copy emoji panel grouped by category.
- **Storage Usage** — real per-drive used/free space, plus sizes for
  your Desktop/Documents/Downloads/Pictures/Music/Videos folders.
- **Startup Apps** — lists real Windows startup entries
  (`HKCU...\Run`) with a Remove button.
- **Real process tree** in System Monitor — toggle from Anchoran's own
  windows to every real Windows process, expandable by parent/child,
  with a confirmed "End task".

### Changed

- **Files now defaults to List view** instead of Grid.

## [2.1.11] - 2026-09-11

### Fixed

- **Notes' layout was broken** (toolbar squeezed to one side, editor
  pushed off to the right) — a leftover `display: flex` row layout from
  before Notes became a full Notepad-style editor. Now uses the same
  column layout every other app does.
- **"Open with…" did nothing** — `rundll32`/`shell32.dll` were resolved
  by bare name instead of a fully-qualified path, and failures were
  silently swallowed. Now uses explicit paths and logs any failure
  instead of failing invisibly.

### Added

- **Sort options in Files**: Name (A–Z/Z–A), Newest/Oldest first,
  Largest/Smallest first — folders always stay grouped before files.
- **An address bar in Files**: shows the real current path and lets you
  type one to jump straight there; an invalid path shows an error and
  never changes the current folder.

## [2.1.10] - 2026-09-11

### Added

- **17 new dedicated file-type icons** in Files, covering the full
  range of common extensions (documents, PDF, presentations, ebooks,
  email, vector/design, 3D models, video, audio, disk images,
  executables, databases, fonts, game ROMs, certificates, shortcuts,
  subtitles) instead of a generic icon for everything beyond images/
  audio/video/archives/code/spreadsheets.
- **Quick Look**: press **Space** on a selected file in Files (or
  right-click → Quick Look) for a real, read-only preview without
  opening it — images and SVGs render directly, PDFs use Chromium's
  own built-in viewer, .zip archives list their real contents without
  extracting anything, and text/code shows as plain monospace text.

## [2.1.9] - 2026-09-11

### Changed

- **Photo Viewer and Zip Tool now install by default** — they're the
  only two Webstore apps (besides Notes and Media Player, already
  default) that actually open a specific real file type from disk
  (images, and .zip archives).

## [2.1.8] - 2026-09-11

### Added

- **System Mode is now on by default** every launch (previously an
  opt-in toggle each session) — per explicit request.
- **Per-app volume mixer** in Quick Settings: independent volume/mute
  sliders for Browser, Chat and Media Player, on top of the existing
  system-sounds volume. Browser/Chat apply it to their real `<webview>`
  guest page; Media Player applies it directly to its own player.
- **Multiple user profiles**: Settings → Users can now create, switch
  between and delete profiles, each with its own name, avatar, PIN,
  accent color, wallpaper and theme. The lock screen shows a profile
  picker whenever more than one exists. Scope note: app data (Notes,
  Files, and every other app's own data) is shared across profiles —
  this covers identity and appearance, not full per-user data
  isolation.

## [2.1.7] - 2026-09-11

### Fixed

- **Files' "<" button now always goes to the actual parent folder**,
  fixing a case where going up from a top-level folder (e.g.
  `C:\Users`) skipped straight to "This PC" instead of stopping at the
  drive root (`C:\`) first.

### Added

- **Files shows more specific icons per file extension** instead of a
  generic file icon for everything — images, audio/video, archives
  (.zip/.rar/.7z), code files, spreadsheets (.csv/.xlsx) and documents
  (.txt/.md/.pdf/.doc) each get their own icon.

## [2.1.6] - 2026-09-11

### Changed

- **Desktop icons reverted to pinned app shortcuts only** — v2.0.0
  briefly made them mirror your real Windows Desktop folder; that's
  gone, Anchoran's desktop stays its own stable surface again.
- **Browser is back to being a real browser embedded inside Anchoran**
  (Electron's `<webview>`, genuinely running the Chromium engine) —
  not an external launch of a separate Chrome process, and not labeled
  "Google Chrome" either way, since it isn't the actual Google-branded
  product.
- **Files no longer silently opens unsupported file types with
  whatever Windows' default app is.** Double-clicking a file type
  Anchoran doesn't natively handle (anything besides images and text)
  now shows a clear message instead — right-click → Open with… is the
  explicit way to launch a real Windows app for it.

## [2.0.0] - 2026-09-11

### Changed — major architecture shift

- **Files now browses your real Windows filesystem, replacing the
  isolated virtual filesystem entirely.** "This PC" shows your actual
  Desktop, Documents, Downloads, Pictures, Music, Videos and drives;
  every operation (create, rename, move, copy, cut/paste, multi-select)
  acts on real files and folders. Deleting sends items to the real
  Windows Recycle Bin — recoverable there, same as Explorer — rather
  than the old virtual Trash. Right-click → **Open with…** opens
  Windows' own real "How do you want to open this file?" picker.
- **Desktop icons are your real Windows Desktop folder now**, not a
  virtual stand-in.
- **Browser downloads go straight to your real Downloads folder** —
  the previous interception that imported them into the virtual
  filesystem is gone (it also wasn't working reliably).
- **Notes is now a real Notepad-style editor**: it can open, edit, save
  and "Save As" any real text file on your PC via the native Open/Save
  dialogs, instead of being limited to its own fixed virtual folder.
- **Paint, Pixel Art, Wallpaper Maker, Screenshot, Voice Recorder and
  Screen Recorder now save into your real Pictures/Music/Videos
  folders**; Photo Viewer and Media Player browse those same real
  folders directly.
- **Zip Tool now zips/unzips real folders** you pick from disk, instead
  of the virtual filesystem.
- **"Anchoran Browser" is gone.** In its place, the Browser entry opens
  your actual, already-installed Google Chrome as its own separate
  Windows application (falling back to your default browser if Chrome
  isn't installed) — using Chrome's name for an embedded, Anchoran-made
  imitation of it would have been misleading.
- **Fixed: right-click didn't work inside embedded web content**
  (`<webview>`, e.g. in Chat) — Electron doesn't give guest pages a
  context menu for free. Added a real one (Copy, Copy Image, Copy
  Link, Cut/Paste, Select All, Reload) built from the actual click
  target.

### Fixed

- Registering the Windows key as a global shortcut could throw instead
  of failing gracefully on some Electron/Windows combinations, which —
  because it ran unguarded at startup — silently skipped every startup
  step after it (the Ctrl+Alt+L fallback, download handling, CPU
  sampling, the first update check). Now handled explicitly.

## [1.19.1] - 2026-09-11

### Fixed

- **Registering the Windows key as a global shortcut could throw
  instead of failing gracefully**, on some Electron/Windows
  combinations (`TypeError: Error processing argument at index 0,
  conversion failure from Super`, caught via a real user's Event
  Viewer log — thanks!). Because this ran unguarded inside
  `app.whenReady().then(...)`, an uncaught throw here silently skipped
  every startup step after it too: the Ctrl+Alt+L fallback shortcut,
  Browser download interception, CPU sampling for System Monitor, and
  the first update check on launch. Both shortcut registrations are
  now wrapped so a thrown exception is treated exactly like the
  documented `false` return value, logged, and startup continues
  normally either way.

## [1.19.0] - 2026-09-11

### Added

- **System Mode**: Anchoran can now claim the Windows key and Alt+Tab
  system-wide while it's running (Settings → System Mode, off by
  default every session), via a new native helper
  (`native/kioskhook`, a small self-contained .NET process) that
  installs a low-level Windows keyboard hook — without touching how
  Windows boots, logs in, or what was already running before Anchoran
  started. Pressing Win opens Anchoran's Launcher instead of the Start
  Menu; Alt+Tab opens Anchoran's own window switcher. Turning it off,
  closing Anchoran, or a plain reboot all immediately hand the keys
  back to Windows — and Ctrl+Alt+Delete is never affected, by Windows'
  own design, regardless of this feature. See `TODO.md` for the full
  design notes, safety reasoning, and what's still pending (real
  on-device key testing, code signing).
- **Default-installed apps are now protected from uninstall**, not
  just the four core ones — this now also covers System Monitor,
  Network Monitor, Event Viewer, Media Player and Magnifier, which are
  also installed by default from this version on.

## [1.18.1] - 2026-09-11

### Fixed

- **The Windows taskbar/executable icon was still the old placeholder
  anchor mark** instead of the real branded logo — `build/anchoran-icon.ico`
  had never been regenerated from the new logo asset. Rebuilt it as a
  proper multi-resolution icon (16 to 256px) from the actual mask,
  tinted with Anchoran's default accent color (an app icon baked into
  the .exe can't dynamically follow the user's live accent color the
  way the in-app logo does, so it uses the default). Also replaced the
  same stale placeholder logo used for the browser tab favicon and the
  fullscreen installer's own branding — all three now match.

## [1.18.0] - 2026-09-11

### Added

- **The last 3 apps from the original 34-app plan**: Spreadsheet (cell
  references and formulas — `=A1+B2`, `=SUM(A1:A5)` — via a small
  dependency-free formula engine, no `eval`), Magnifier (a live
  magnifying lens that follows your cursor over a real captured screen
  feed, 2x/3x/4x), and Screen Recorder (records the real screen to a
  `.webm` video, saved into Files and playable in Media Player).

This closes out the full app-and-feature backlog planned for this
update. `TODO.md` tracks what's next (the "secondary OS" kiosk-mode
idea) as a deliberately separate, not-yet-started initiative.

## [1.17.0] - 2026-09-11

### Added

- **6 more apps** ("Wave 8", the batch needing real OS integration):
  Screenshot (captures your actual screen via Electron's
  `desktopCapturer`, no simulation), Voice Recorder (records from your
  real microphone via `MediaRecorder`), Network Monitor (live
  online/offline status and real measured latency), Event Viewer
  (reads Anchoran's own real on-disk log file — the same one that's
  always recorded errors, update checks and shortcut failures, now
  actually visible), Media Player (plays imported or recorded
  audio/video), and Zip Tool (exports any folder to a real `.zip`, or
  imports one from Windows, via JSZip).
- `TODO.md`: tracks the "secondary OS / kiosk mode" idea discussed but
  not yet started — launching Anchoran on top of an already-running
  Windows session, claiming the Win key and Alt+Tab via a native
  low-level keyboard hook while Windows keeps running underneath
  untouched, with a normal reboot or Anchoran's own shutdown as the way
  back. Deliberately not the Winlogon shell-replacement approach.

## [1.16.0] - 2026-09-11

### Added

- **4 more apps** ("Wave 7"): Paint (freehand canvas drawing), Pixel
  Art (a 16x16 grid editor), Wallpaper Maker (gradients/patterns you
  can set as your desktop wallpaper or save), and Photo Viewer (browses
  every image saved anywhere in Files).
- **Files now shows real image thumbnails** for any file whose content
  is an image (from Paint, Pixel Art, Wallpaper Maker, or an imported
  photo) — both in the grid and when you open the file — instead of
  the generic file icon.

## [1.15.0] - 2026-09-11

### Added

- **6 more apps** ("Wave 6"): Password Vault (real AES-GCM encryption
  derived from a master password via PBKDF2 — the password itself is
  never stored, only used to re-derive the key), Reminders (real
  timers that fire a notification at a set time of day), Text to
  Speech (reads any text aloud via the system's speech voices, with
  adjustable rate), Mind Map (a draggable node/link idea sketchpad),
  Solitaire (full Klondike, with foundations and a recyclable stock),
  and Chess (complete legal-move, check, checkmate and stalemate
  detection for local two-player play).

## [1.14.0] - 2026-09-11

### Added

- **7 more apps** ("Wave 5"): Calendar (monthly view with your own
  events), Clipboard Manager (a real history of everything copied
  inside Anchoran, captured live), Kanban Board (drag cards across
  To Do/Doing/Done), Text Diff (line-by-line comparison of two texts),
  Habit Tracker (daily check-ins with streaks), Currency Converter and
  Weather — the last two backed by live, free, no-key APIs
  (frankfurter.app and Open-Meteo).

## [1.13.0] - 2026-09-11

### Added

- **Print**: Notes, the Files text editor and JSON Formatter can now
  print their content to a real PDF (built client-side with jsPDF),
  opened with the user's actual Windows PDF viewer — a genuine file on
  disk, not a simulation.
- **Task Manager**: System Monitor now lists every running app/window
  with an "End task" button, on top of its existing CPU/memory stats.
- **Auto-lock**: Settings → Users can now set Anchoran to lock itself
  automatically after 1–60 minutes of inactivity. Only active once a
  PIN is set, so it can't lock you out of an account with no way back
  in.
- **Keyboard Shortcuts**: a new Settings → Shortcuts page documents
  every shortcut Anchoran responds to, in one place.

## [1.12.0] - 2026-09-11

### Added

- **Files**: multi-select (click, Ctrl/Cmd+click), cut/copy/paste
  (Ctrl+X/C/V or a real right-click menu), rename in place, and full
  undo/redo (Ctrl+Z / Ctrl+Y) across every file operation — create,
  rename, move, delete, restore, duplicate. Multi-select also works for
  Delete, Restore and Delete permanently in Trash.
- **Desktop icons are now real.** A new "Desktop" folder in Anchoran's
  filesystem holds actual files/folders shown as draggable icons on the
  wallpaper, alongside pinned app shortcuts; both kinds can be freely
  repositioned, renamed and deleted from a right-click menu.
- **Desktop right-click menu**: New Folder, New File, Sort Icons (snaps
  every icon back to the default grid), and Change Wallpaper (now
  actually opens Settings instead of just suggesting it).
- **Window snapping** now also supports the four screen corners
  (quarter-tiling), in addition to the existing left/right-half and
  top-to-maximize snap zones.
- **Quick Settings**: a new flyout from the taskbar's system tray with
  volume, brightness, Night Light, Focus (Do Not Disturb) and Battery
  Saver toggles, plus a shortcut into full Settings.
- **Night Light**, a **Brightness** slider, **High contrast** and
  **Large text** accessibility toggles, all in Settings → Display (and
  the Quick Settings flyout for the first three). The Interface Scale
  slider, previously not connected to anything, now actually resizes
  the UI too.

### Changed

- Settings' "About" tab is now named "Updater" — it was always the
  update-checking/version/history screen, so the label now matches
  what it does.

## [1.11.0] - 2026-09-11

### Added

- **7 more games** ("Wave 2a"): Dice Roller, Coin Flip, Connect Four,
  Checkers, Minesweeper, Sudoku (three difficulty levels, generated
  fresh each game with a unique solution) and a Typing Speed Test.

### Fixed

- **System sounds (boot chime, notifications, errors) were completely
  silent.** Chromium's autoplay policy blocks any audio — including a
  synthesized Web Audio API tone — from starting before a real user
  gesture has happened on the page, and Anchoran's boot chime plays
  automatically at the end of the boot sequence with no click first.
  The main process now launches with `autoplay-policy=no-user-gesture-required`,
  and the renderer additionally resumes the audio context on the very
  first click or key press as a fallback.

## [1.10.0] - 2026-09-11

### Added

- **11 new built-in applications** ("Wave 1" of the Webstore app batch),
  all installable/uninstallable through the Anchoran Webstore like any
  other app:
  - **Chat** — Anchoran's messaging app, embedding the user's own
    Firebase-backed chat project.
  - **To-Do List** — a persisted checklist with add, complete, delete
    and a "hide done" filter.
  - **Pomodoro Timer** — focus/short-break/long-break sessions with a
    circular progress ring and a completed-sessions counter.
  - **QR Code** — generates a QR code from any text or link.
  - **Password Generator** — configurable length and character sets,
    with a live strength meter, generated with `crypto.getRandomValues`.
  - **JSON Formatter** — format, minify and validate JSON with inline
    error reporting.
  - **Word Counter** — live word, character, sentence, paragraph and
    reading-time counts.
  - **Snake**, **2048**, **Tic-Tac-Toe** and **Memory Match** — four
    classic games, keyboard- and click/tap-playable, each tracking score
    or moves for the current session.
- The **Games** category is now shown in the Webstore alongside System,
  Productivity, Utilities and Internet.
- Anchoran Browser now opens to Google by default instead of a
  placeholder page, and is labeled "Anchoran Browser" throughout the
  system.

## [1.9.0] - 2026-09-11

### Added

- **Anchoran Webstore's catalog now comes from GitHub, version-locked.**
  Each release publishes a `webstore-registry.json` snapshot — a
  cumulative list of every app that exists as of that version — attached
  to its GitHub Release. Opening the Webstore fetches the registry from
  the *release matching the currently running version*, so a user on an
  older build only ever sees apps that existed for their version, never
  ones a later release added. Falls back to this build's own bundled
  list if GitHub can't be reached (offline, rate-limited, or this exact
  version was never tagged as a release — e.g. a local dev build) —
  shown in the Webstore's sidebar either way.
- **The Launcher now only lists installed apps** (previously it listed
  everything regardless of the Webstore's install state) — matches how
  a real OS launcher works, and makes "Install" from the Webstore
  actually mean something.
- **Uninstall** is now possible for any non-core app, from the
  Webstore's app detail view. Files, Terminal, Settings and the
  Webstore itself are core and can't be removed.
- Install/uninstall state is now a single shared store (previously
  local to the Webstore component only), kept in sync between the
  Webstore, Launcher, and Taskbar.

### Changed

- App metadata (`apps.json`) is now the one source of truth for both
  Anchoran's local app list and each release's published Webstore
  catalog — they can no longer drift apart.

## [1.8.0] - 2026-09-11

### Added

- **Browser downloads no longer touch Windows' real Downloads folder.**
  The Browser app's downloads are intercepted at the source and imported
  straight into Anchoran's own Files app (Downloads folder) instead —
  text-based files keep their real content; binary files are added
  without content (same documented limitation as drag-and-drop import).
- **Files: double-click a file to open it.** A lightweight built-in
  text editor now opens in place, with a live-saving textarea and an
  editable filename — previously double-clicking a file did nothing.

## [1.7.0] - 2026-09-11

### Fixed

- **Restoring a minimized window immediately re-minimized itself.**
  `WindowFrame` stays mounted across minimize/restore (it just renders
  nothing while minimized), but its exit-animation state was never
  reset — so restoring replayed the leftover "minimizing" animation the
  instant the window reappeared. Fixed by resetting that state whenever
  a window stops being minimized.

### Added

- **Taskbar apps can now be reordered** (drag an icon to a new
  position among the pinned ones) **and pinned/unpinned** (right-click
  any taskbar icon, or use the new pin button on each Launcher result).
  The pinned set and its order persist across restarts.

## [1.6.0] - 2026-09-11

### Fixed

- **Installer filenames were dangerously similar**: `Anchoran-OS-Setup-*.exe`
  (the internal NSIS engine — never meant to be run directly) vs.
  `Anchoran Setup *.exe` (the real, fullscreen installer end users should
  download) were one word apart, and it caused exactly the confusion
  you'd expect. Renamed clearly: the internal one is now
  `AnchoranOS-UpdatePackage-<version>.exe`, the one to actually run is
  `AnchoranOS-Setup-<version>.exe`. The GitHub Release description also
  now says explicitly which file to download.
- Launcher fallback shortcut reverted from `Ctrl+Win` back to
  `Ctrl+Alt+L` — `Ctrl+Win`, despite not being the bare Windows key,
  turned out to still be claimed by Windows itself on some machines
  (e.g. Ink Workspace/accessibility shortcuts).
- **Maximizing a window left a gap at the bottom and kept rounded
  corners.** Maximized windows now fill the entire screen with square
  corners, and the taskbar auto-hides itself while any window is
  maximized — sliding away, reappearing on hovering the very bottom
  edge, and turning back off automatically the moment a window is
  restored or minimized.

### Added

- **First-run welcome wizard** (`Onboarding`): shown once, the first
  time Anchoran boots after installing — set a username, an optional
  lock PIN, an optional profile picture, and a wallpaper, each step
  skippable. Takes the place of the lock screen and the generic
  "Welcome" toast that first time only.
- **"Import from Windows…"**: a shared image-import dialog, now used for
  wallpapers (Settings → Personalization) and the account profile
  picture (Settings → Users, and during onboarding) — picks a real photo
  from the user's own files instead of only Anchoran's built-in
  gradients.
- The lock screen now shows the imported profile picture instead of
  just an initial, when one is set.

## [1.5.0] - 2026-09-11

### Added

- **`UpdateTheater`**: a Windows-Update-style "Working on updates"
  sequence shown before an update actually installs — a held progress
  screen with 1-3 simulated restart cycles (randomly 7-12s apart, each
  with a brief black flash) and copy warning it might take a while and
  restart itself. Runs entirely inside the still-open Anchoran window;
  nothing here is the real install (see the "Known limitation" note
  below).
- `UpdateReadyScreen` now asks "Update now?" for confirmation before
  starting, instead of updating immediately on the first click.
- Boot screen's "finishing an update" mode (added in 1.4.0) is now its
  own sequence: no progress bar (there's nothing left to measure, the
  work already happened), just calm rotating reassurances — "Just a
  bit more…", "Getting things ready…", etc. — fading in and out over a
  fixed 8 seconds.
- `AnchoranSetup`'s first-install screen restyled to match: the same
  "Setting up Anchoran OS" headline/blurb/thin-bar language as the
  update theater, plus the same cosmetic restart-flash effect layered
  over its real, IPC-driven install progress (which — unlike an
  update — Anchoran can actually observe, so it isn't faked, just
  visually unified).

### Known limitation (unchanged, worth restating here)

The pre-install theater above runs entirely before Anchoran actually
quits — the real silent install still requires the running app to
fully exit first (it has to, to overwrite its own files), which is a
genuine several-seconds gap with nothing on screen, however elaborate
the theater beforehand. `1.4.0`'s "Finishing update…" boot message
covers that moment on the other side of the gap; nothing can cover the
gap itself.

## [1.4.0] - 2026-09-11

### Added

- **Anchoran Webstore** (formerly App Center): search, category filters
  (System/Productivity/Utilities/Internet), and a per-app detail view —
  and installed apps now persist across restarts instead of resetting
  every session.
- **Three new built-in apps**, available to install from the Webstore:
  **Clock** (world clocks, stopwatch, countdown timer), **Converter**
  (length, weight, temperature, data size), and **Color Picker** (HEX/
  RGB/HSL with one-click copy).
- Boot screen now says **"Finishing update to vX.Y.Z…"** when this boot
  follows a silent update install, instead of the generic startup
  sequence — a silent NSIS install has nothing to show on screen while
  it runs (the app has to quit for the installer to overwrite its own
  files), so this turns that unavoidable gap into a legible "the update
  is finishing" moment once Anchoran reopens.

## [1.3.2] - 2026-09-11

### Changed

- Launcher fallback shortcut changed from `Ctrl+Alt+L` to **`Ctrl+Win`**
  — more discoverable, and reliably registers since Windows' Start Menu
  only claims a *clean* press of the bare Windows key, not one held with
  Ctrl.

## [1.3.1] - 2026-09-11

### Fixed

- The `Ctrl+Space` fallback Launcher shortcut didn't work — it commonly
  collides with Windows' own input-method/keyboard-layout switch hotkey.
  Changed to `Ctrl+Alt+L`. Anchoran now also tells you (a notification)
  if neither the Windows key nor the fallback could be registered at
  all, instead of failing silently.

## [1.3.0] - 2026-09-11

### Fixed

- **Critical: Settings never actually saved anything.** Every
  preference setter (theme, accent color, wallpaper, UI scale,
  animations, username, sound, lock PIN) persisted `{ ...get(), field }`
  — the *entire* Zustand store, including its action methods — instead
  of just the data. Functions can't cross Electron's IPC boundary, so
  every one of those writes failed silently; nothing in Settings ever
  survived a restart or an update. Fixed to persist only the actual
  preference fields.
- `persistSet` (the shared persistence helper used everywhere) now
  guards against this whole class of bug generally: it JSON-round-trips
  the value before saving (stripping anything unclonable) and logs to
  Anchoran's own error log on failure instead of swallowing it — so a
  future mistake like this one fails loudly, not silently.

### Added

- **Anchoran now always starts locked**, like a real PC — the lock
  screen appears after boot every time, requiring the PIN if one is
  set, or any input to continue if not.

## [1.2.4] - 2026-09-11

### Fixed

- The release workflow published each Release without explicitly
  marking it published/latest, leaving it stuck as a draft and/or not
  shown as the repo's "Latest release" until manually fixed on
  github.com. `release.yml` now passes `draft: false`, `prerelease:
  false`, and `make_latest: "true"` explicitly.

## [1.2.3] - 2026-09-11

### Fixed

- `quitAndInstall()` was called with no arguments, which defaults to a
  **non-silent** install — the full NSIS wizard reappeared instead of
  installing seamlessly behind the "Restart & Update" screen. Now calls
  `quitAndInstall(true, true)` (silent, force-relaunch after). Note:
  this only takes effect starting from *this* version onward — the
  currently-running version always decides how its own update installs,
  so updating from an older build still shows its old behavior.

## [1.2.2] - 2026-09-11

### Fixed

- Removed a stray nested full clone of this same repo (`Anchoran OS/`,
  committed as a broken git submodule reference) and a leftover junk
  file (`System.Drawing.Drawing2D.GraphicsPath`) from an earlier local
  icon-generation script bug, both accidentally committed in `1.2.1`.

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
