# Changelog

All notable changes to Anchoran OS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).

## [3.0.3] - 2026-09-13

**Update type:** stability

### Fixed
- A downloaded update's "ready to install" prompt (the fullscreen
  screen, and Settings → About's own "Restart & install" button) could
  stay stuck showing forever, even after a later check said "Anchoran
  OS is up to date" — most visibly after toggling Insider Preview
  updates off right after downloading an I.P.U. build, since a
  subsequent check finding no newer *stable* release never cleared the
  earlier "downloaded" state. A fresh "not-available" result now
  clears it, so the two messages can't contradict each other anymore.
- The GitHub release description's opening line still spelled out the
  plain "v3.0.2"-style version even for releases after v3.0.0, instead
  of the new display convention used everywhere else. Also extended
  the new convention to a few Terminal banners (`about`, `system`) that
  hadn't been switched over yet, and diagnostics exports now show both
  the new label and the underlying real version for reference.

## [3.0.2] - 2026-09-13

**Update type:** stability

### Fixed
- The "ready to install" screen showed the offered update's plain
  version (e.g. "Anchoran OS 3.0.1-IPU is ready to install") instead
  of the same display convention used everywhere else — now reads
  "Anchoran OS Version 3 | Build 3H0.1 I.P.U. is ready to install".
- `versionLabelFor()` now infers a version's I.P.U./stable channel
  from its own "-IPU" suffix when no channel is passed explicitly,
  instead of silently defaulting to "stable" — this was the root
  cause of the naming bug above.

## [3.0.1] - 2026-09-13

**Update type:** stability

### Fixed
- **An Insider Preview device could never actually receive the stable
  release of the same version.** v3.0.0-IPU and v3.0.0 stable
  deliberately shared an identical version number, which meant
  electron-updater's real version comparison saw them as equal and
  reported "up to date" — `anchoran changeto` had the same problem.
  I.P.U. builds now get a real semver prerelease suffix baked into
  their own version.json at build time only (e.g. "3.0.0" becomes
  "3.0.1-IPU" for that specific build, never committed to the repo) —
  SemVer defines a prerelease version as always lower precedence than
  the same X.Y.Z without one, so the stable release now correctly
  compares as newer and is actually offered. `src/core/buildChannel.ts`
  now derives the "Insider Preview build" badge straight from that
  same suffix instead of a separate build-time marker file, which is
  removed. This fix only takes effect starting with this version —
  anyone stuck on the already-shipped v3.0.0-IPU build should download
  the stable v3.0.0 installer directly rather than waiting for an
  update prompt that build's older code can never generate.

## [3.0.0] - 2026-09-13

**Update type:** feature

### Added
- Anchover now shows an "Insider Preview build" badge when the
  specific binary running was built from an I.P.U. tag — a real
  build-time marker (`src/core/buildChannel.json`, baked in by the
  release workflow), not something derived from the version number,
  since an I.P.U. build and its later stable release of the same
  version deliberately share the same version number.
- Release notes — both the GitHub release body and the in-app "What's
  new" panel — now cover every version in an Insider Preview Update
  streak, not just the one being installed right now. I.P.U.s can
  chain across several version bumps with no stable release cut in
  between (see the README's versioning section); anyone who updates
  straight from the last real stable release, skipping every I.P.U.
  along the way, still sees everything that changed.

### Changed
- **New versioning display convention, starting with this release**:
  everywhere a person reads Anchoran's version — the boot screen,
  Settings → About, Anchover, taskbar update tooltips, the App Center —
  now shows "Version {major} | Build {major}H{minor}.{patch}" (e.g.
  "Version 3 | Build 3H0.0") instead of the plain dotted version
  number. `v3.0.0` is the very last release named in the old style on
  GitHub; every release after it uses the new naming there too. This
  is purely a display change — git tags, `version.json`, download
  URLs, and every Terminal command that matches a real release
  (`anchoran changeto`, `anchoran version`) all keep using real SemVer
  forever, so the update mechanism itself is unaffected either way.

### Fixed
- The Update history list (Settings → About) could show a transition
  like "v3.0.0 → v3.0.0" — no visible change at all — for exactly the
  one case that's expected to happen a lot: going from the v3.0.0
  Insider Preview build to the v3.0.0 stable release, which share an
  identical version number by design. It's now tracked by build
  channel as well as version, and shown as "v3.0.0 I.P.U. → v3.0.0".
  The same fix applies everywhere else a specific version gets named —
  `anchoran changeto`'s list, "Update available"/"ready to install" —
  which also now show each version the way it actually shipped (old
  "vX.Y.Z" style up through v3.0.0, the new style after) instead of
  applying the new style retroactively to versions that predate it.

## [2.9.9] - 2026-09-13

**Update type:** feature

### Added
- Every release now carries a small `update-info.json` asset
  classifying what *kind* of update it is — Security, Critical,
  Stability, Feature, Performance or Maintenance Update — set per
  version via a `**Update type:**` line in this changelog and shown by
  the updater in the update-ready screen and Settings → About.
- Releases now ship in two stages. Every update first goes out as an
  **Insider Preview Update (I.P.U.)** — a GitHub prerelease, offered
  automatically only to devices with Insider Preview updates enabled
  (Settings → About) — and only ships as a normal release, available
  to everyone, once that build is confirmed bug-free.

## [2.9.8] - 2026-09-13

### Changed
- Removed the lock screen's separate "Continue as Guest" button — now
  that Guest is a single permanent profile, it already shows up as its
  own tile alongside every other profile, so a dedicated button was
  redundant. Selecting the Guest tile still resets it to its fixed
  defaults every time, exactly like the old button did.

## [2.9.7] - 2026-09-13

### Fixed
- The in-app "What's new" release notes rendered badly — CHANGELOG.md
  is hand-wrapped at ~72 columns for plain-text readability, but the
  markdown renderer turned every wrapped line into its own separate
  `<p>`, so a single paragraph showed up as a tall stack of one-line
  blocks. Consecutive lines now merge into one paragraph, like real
  markdown's soft-wrap convention.

### Changed
- Settings → About's "Beta channel" toggle is now labeled "Insider
  Preview updates", matching more familiar update-channel naming.

### Added
- **Anchover** — Anchoran's own `winver` equivalent: a small "what
  build is this" screen (logo, "ANCHORAN OS" + major version, full
  product name, version, licensing line). It's a real, ordinary app,
  but deliberately not discoverable — it never appears in the
  Launcher's browse-all list, the letter-jump index, the Webstore
  catalog, or the Terminal's `anchoran apps` listing, and only turns
  up in Launcher search when you type its exact full name, the same
  way winver isn't pinned anywhere on a real Windows install.

## [2.9.6] - 2026-09-13

Bug fixes and a Guest profile redesign, from live-testing the v2.9.2
stability fix.

### Fixed
- Deleting your own active profile from Settings no longer silently
  switches you into another profile with no confirmation or PIN. It
  now shows a true fullscreen confirmation (`DeleteOwnProfileConfirm`,
  same pattern as the update-ready screen) and sends you to the lock
  screen if you confirm.
- Restoring a Trash item whose original location was a drive root
  (e.g. `D:\`) no longer crashes with `EPERM: operation not permitted,
  mkdir 'D:\'` — `fs.mkdirSync` is now only called when the
  destination folder is actually missing, since Windows refuses to
  "create" a volume root.
- Rename now works in Files' list (table) view — the default view —
  which never had a rename input at all, only the grid view did.
  Rename also now selects just the base filename (not the extension),
  matching Windows Explorer, while still leaving the extension
  editable if you want to change it.
- The columns (Miller columns) view had zero right-click menu support;
  it now has the same context menu as the other views. Its non-active
  columns also showed entries in raw, unsorted order — opening a
  subfolder made the column you drilled out of visibly reorder itself.
  Every column now sorts consistently.
- Anchoran's own Recycle Bin icon (desktop and Launcher) now opens
  Anchoran's own Trash instead of launching the real Windows Explorer
  recycle bin.
- Every app window now has a real minimum size, so shrinking a window
  can't push its toolbar buttons off-screen — both when manually
  resizing and when a window reopens at a small size remembered from
  before this fix.

### Changed
- **Guest Mode is now a single, permanent profile** instead of a
  fresh throwaway one created (and deleted) on every use. It always
  appears in the profile list, can't be deleted or renamed, and can't
  set a PIN or change its own appearance — name, avatar, theme,
  accent color and wallpaper are all locked in Settings while signed
  in as Guest. Its appearance resets to fixed defaults every time it's
  entered, incognito-style, so nothing a previous guest session
  changed ever lingers.
- The taskbar's separate notifications bell is gone — the clock button
  on the right now opens the same panel (calendar + notifications),
  carrying the unread badge itself. The panel now also shows the
  current time with live seconds at the top, since the taskbar clock
  itself only ticks by the minute.

## [2.9.2] - 2026-09-13

**Critical fix — v2.9.1's fix was itself incomplete; the app could
still crash on every second launch.** The real, complete root cause,
found from a full stack trace this time: the *placeholder* stores
created at module load — `let configStore = new Store({ name:
"preferences", cwd: configDir })`, before `app.whenReady()` and
before any of v2.9.1's own protections — pointed at the exact same
file as the real encrypted store, with no encryption key. electron-
store's `Conf` constructor reads and `JSON.parse`s whatever's already
on disk immediately, synchronously, in the constructor itself. Once a
session had legitimately finished encrypting that file, every
subsequent launch hit the placeholder trying to parse encrypted
binary as plain JSON — crashing before `app.whenReady()` (and v2.9.1's
try/catch inside it) ever ran. Not a rare corruption edge case: a
guaranteed crash on the second launch of any session onward.

### Fixed
- The placeholder stores now point at names that are never the real
  data files (`preferences-boot-placeholder` /
  `filesystem-boot-placeholder`), so they can never collide with
  content that might already be encrypted. They're fully replaced by
  the real, correctly-keyed stores at the very start of
  `app.whenReady()`, before anything else runs.
- `anchoran:config-set` / `anchoran:data-set` now catch and log a
  write failure instead of letting one propagate uncaught.

## [2.9.1] - 2026-09-13

**Critical fix — v2.9.0 could fail to start at all.** The encryption-
at-rest migration added in v2.8.9 (#17) had a real bug: on a machine
that still had a plaintext preferences/filesystem store from before
that feature existed, `openEncryptedStore()` constructed a new,
encryption-configured `Store` directly on top of the still-plaintext
file. electron-store reads whatever's on disk immediately at
construction time, so handing it an encryption key while the actual
bytes underneath were plain JSON made it try to AES-decrypt plaintext
— which reliably threw a `SyntaxError`, uncaught, before
`createMainWindow()` ever ran. Since the migration marker is only
written *after* that line, the exact same crash repeated on every
single subsequent launch, with no way back in from inside the app.

### Fixed
- The plaintext file is now renamed out of the way *before* a Store
  configured with the encryption key is ever constructed on that path,
  removing the failure mode entirely. The original data is kept as
  `<name>.json.pre-encryption-backup`, not deleted, in case anything
  else about the migration ever needs re-checking.
- Wrapped the whole encryption setup in `app.whenReady()` in a
  try/catch that falls back to the plain (still fully functional)
  stores on any unexpected error, instead of ever again being able to
  block the app from starting over a preferences-file issue.
- An already-migrated store that somehow still fails to open now logs
  and starts fresh (backing up the bad file) instead of crashing too.

## [2.9.0] - 2026-09-13

The final wave of the 94-item "what would you improve about the whole
system" list — 10 items, numbered against the original list. Together
with the four waves before it, this closes out every item that isn't
blocked by needing a paid code-signing certificate (#20) or real
ARM64 hardware to verify (#92). The minor version bump marks that: the
whole backlog this was built against is now done.

### Added
- **#81 Reminders with real repeat modes** — Once / Every day /
  Weekdays, instead of every reminder always firing daily; a one-time
  reminder turns itself off after it fires.
- **#82 Password Vault's own generator** — a "Generate" button right
  in the entry form (16 characters, every class, a real CSPRNG), not
  just a link out to the separate Password Generator app.
- **#84 Smaller installer** — `compression: maximum`, plus excluding
  React/Zustand/JSZip/jsPDF (already inlined into the Vite bundle —
  Electron-builder was shipping their raw source a second time for
  nothing) and common node_modules bloat (source maps, docs, tests)
  from the packaged app.
- **#85 Preloading frequently-used apps** — a few seconds after boot,
  the JS chunks for whichever apps you actually open most start
  fetching in the background, so their first real open doesn't wait on
  the network/disk.
- **#86 Optional beta update channel** — a working switch in Settings
  → Updater. Honest scope note: Anchoran's own release workflow
  doesn't publish pre-release builds yet, so there's nothing beta to
  find until it does — the mechanism is real either way.
- **#87 In-app release notes** — "What's new" in Settings → Updater
  renders the current version's real CHANGELOG.md entry, instead of
  only being available via the Terminal's `anchoran changelog`.
- **#88 Automatic update-failure detection** — if a newly-updated
  version never confirms a successful boot on its first launch, the
  next launch surfaces a notice with a one-click reinstall of the last
  version known to work. True silent binary rollback isn't attempted
  (Anchoran doesn't retain old installer bytes) — this is the honest,
  one-click-away version.
- **#89 A real expansion of the automated tests** — from 7 to 34,
  covering several of this session's own new stores. Caught two actual
  bugs in the process: the markdown renderer's blockquotes never
  rendered (the source was HTML-escaped before the `>` check ran), and
  the Launcher's "frequently used" tie-breaking could tie on
  millisecond-resolution timestamps — both fixed.
- **#91 Lower idle memory: background tab discarding** — a Browser tab
  left inactive for 15+ minutes unmounts its `<webview>` (a real
  Chromium renderer process) entirely; reactivating it remounts fresh.
  Pinned tabs are exempt.
- **#93 Window embedding: resolved, not removed** — this session's
  earlier fixes (process-tree walk, longer timeout) already addressed
  the detection failures; this pass closes the remaining real gap — a
  failed embed previously left a dead window with no way to retry —
  by adding "Try again" / "Choose a different app" to the error state.

### Verification
`typecheck`, `build` (renderer + electron) and `test` (34/34) all pass.

## [2.8.18] - 2026-09-13

Wave 4 of the remaining 94-item list — 15 more items, numbered against
the original list. This wave finishes the Notificaciones and
Navegador categories entirely, and starts Apps núcleo.

### Added
- **#62 Exportable notification history** — Settings → Notifications
  → Export… saves the full history as a plain-text file.
- **#65 Persistent update-available indicator** — a small badge in the
  taskbar tray as soon as an update is found, stays until it's
  installed, independent of whichever screen triggered the check.
- **#66 Reorderable Quick Settings** — drag the Focus/Night Light/
  Power profile/Window Spotlight rows into whatever order you want.
- **#68 Real unread tracking, per app** — notifications now have an
  actual read/unread state (previously the badge just showed the
  total count); the taskbar badge shows unread only, and each app's
  group in the panel shows its own "N new".
- **#69 Browser tab groups** — color-coded groups via the tab context
  menu (new group / add to group / remove / close group).
- **#71 Real tab thumbnail previews** — hovering a tab now shows an
  actual screenshot of it, not just a title list — `<webview>`'s own
  capturePage(), no IPC needed.
- **#72 Reading mode** — a clean, serif article view; extracts
  whichever container has the most paragraph text and pulls out plain
  text (deliberately not raw HTML, so no page content ever needs
  sanitizing before render).
- **#73 Page translation** — opens the current page through Google's
  public, key-free translate.google.com proxy in a new tab. Honest
  scope note: Anchoran has no translation engine or paid API of its
  own.
- **#74 Live search suggestions** — the address bar now also shows
  real autocomplete suggestions from a public, key-free suggest
  endpoint, alongside the existing history/bookmark matches.
- **#75 More robust ad blocking** — the network-level blocklist grew
  from 14 to ~45 real ad/tracker domains, plus new cosmetic CSS hiding
  for common ad containers, plus a visible "N blocked" counter.
- **#76 Full-page screenshot** — scrolls and stitches the entire
  page (not just the viewport) into one PNG.
- **#77 Save complete page** — the real Electron "HTMLComplete" save
  (HTML + every asset, its own folder), distinct from the screenshot
  above — an actual offline-viewable copy of the page.
- **#78 Bookmark folders** — type a folder name on any bookmark to
  file it; the Bookmarks panel groups by folder.
- **#79 Notes markdown rendering** — a Preview toggle renders
  markdown (headers, bold/italic, code, links, lists, quotes) via a
  small built-in renderer, matching how icons/wallpapers/sounds
  elsewhere in Anchoran are generated in code rather than pulled in as
  a library.
- **#80 Calendar week/day views** — Month/Week/Day toggle in the
  toolbar, alongside the existing month grid.

### Verification
`typecheck`, `build` (renderer + electron) and `test` (7/7) all pass.

## [2.8.15] - 2026-09-13

Wave 3 of the remaining 94-item list — 15 more items, numbered against
the original list. This wave finishes the Launcher and Configuración
categories entirely.

### Added
- **#47 Full keyboard-only Launcher** — Up/Down/Enter now reaches any
  visible result (apps, settings, files, browser history, system
  commands), not just the first app match.
- **#48 Visible system commands** — typing "lock", "sign out",
  "restart", "shut down", "sleep" or "power" in the Launcher surfaces
  the matching action directly, the same way Windows' Start menu
  search does.
- **#49 Highlighted setting search matches** — the existing "Find a
  setting…" search now highlights the matched substring in each
  result, not just the section name.
- **#50 Exportable/importable settings profile** — a narrower export
  than the full Backup: just appearance/behavior preferences (theme,
  accent, wallpaper, sound, scale), safe to share or carry to a fresh
  install, under Settings → Privacy.
- **#51 Per-section factory reset** — "Restore defaults for this
  section" on Appearance, Personalization, Display and Sound.
- **#52 Recent settings changes log** — a plain-language "what did I
  just change" list under Settings → Privacy.
- **#53 Full theme presets** — six one-click combos (theme mode +
  accent + wallpaper together) under Appearance.
- **#54 Self-rotating wallpaper (Spotlight-style)** — an optional
  daily auto-rotation through Anchoran's built-in wallpapers, under
  Personalization.
- **#55 Customizable shortcuts** — the modifier combo for snap-to-
  third/switch-desktop and keyboard-resize can each be changed to a
  different combo under Settings → Shortcuts (the OS-level Launcher/
  screenshot shortcuts stay fixed — see the note there).
- **#56 Power profile** — Battery Saver / Balanced / Performance in
  Quick Settings, replacing the old single "reduce animations" toggle
  with three named presets (animations + brightness).
- **#57 Choose what opens minimized at startup** — a new "Anchoran
  apps at startup" list under Settings → System, distinct from the
  existing Startup Apps tool (which manages real Windows Run-key
  programs, not Anchoran's own).
- **#59 True "group by app"** — notifications sharing a source now
  collapse into one group anywhere in the list, not only when they
  happened to arrive back-to-back.
- **#60 Quick actions on notifications** — an optional one-click
  button right on the notification itself ("Open Files" on a drive-
  connected notice, "Undo" on a Files delete), no need to open the app
  first.
- **#63 Per-app notification sounds** — a different tone (or silence)
  per app that's notified you, under Settings → Notifications.
- **#64 Calendar widget in the notification panel** — a compact,
  read-only month view above the notification list.

### Verification
`typecheck`, `build` (renderer + electron) and `test` (7/7) all pass.

## [2.8.12] - 2026-09-13

Wave 2 of the remaining 94-item list — 15 more items, numbered against
the original list.

### Added
- **#24 Terminal tabs** — multiple independent shells in one Terminal
  window, each with its own scrollback and current directory; a "+"
  adds one, and switching keeps every tab's state (nothing unmounts in
  the background).
- **#27 `runscript <file>`** — runs each non-empty, non-`#` line of a
  text file as its own Terminal command.
- **#29 `grep <text>`** — searches this Terminal window's own output
  history for matching lines.
- **#31 Files column view** — a Miller-columns browsing mode (one
  column per folder level drilled into), alongside the existing grid
  and list views.
- **#32 Real color tags** — six color tags assignable to any file or
  folder from its context menu, shown as a small dot in every view.
  Upgrades the single favorite/star toggle from 2.8.7's batch into a
  proper multi-color tagging system.
- **#33 Files sidebar** — Quick access, Favorites and Drives, always
  visible on the left, instead of only reachable from "This PC".
- **#34 Quick Look confirmed already covered** — Space already opens
  an enlarged preview without opening the file; no new work needed.
- **#35 Content search** — a new "Contents" toggle searches inside
  text files (not just names), bounded to files under 512KB that
  Anchoran recognizes as text.
- **#36 Compare folders** — pick a second folder and see what's only
  in one side, different, or identical, top-level entries.
- **#39 Clearer USB/network drive notices** — connecting or removing a
  drive now pushes a real notification instead of only showing up the
  next time Files happens to be reopened.
- **#40 Anchoran's own Trash** — deleting in Files now moves items into
  a trash Anchoran fully owns (browsable and restorable from its own
  sidebar), instead of the real Windows Recycle Bin. **This is a
  deliberate, real behavior change**: deleted files no longer appear
  in Windows' own Recycle Bin — see the note in electron/main.ts.
- **#42 Browser history search in the Launcher** — matching pages from
  Browser's history show up as their own result group.
- **#43 Shortcuts with parameters** — "Pin Administrator shortcut to
  Desktop" (Terminal) and "Create desktop shortcut…" for a specific
  browser tab's URL (Browser's tab menu). An admin shortcut still
  requires the PIN at every launch — the shortcut only remembers the
  intent to elevate, never a standing bypass.
- **#44 Launcher search history** — recent searches shown as chips
  when the search box is empty.
- **#46 Settings keyword search** — searching a specific setting by
  name ("dark mode", "wallpaper", "clipboard auto-clear", …) now
  suggests the section that actually holds it, not just section names.

### Verification
`typecheck`, `build` (renderer + electron) and `test` (7/7) all pass.

## [2.8.9] - 2026-09-12

Wave 1 of "do everything left on the 94-item list that isn't blocked
by needing to pay for something or real ARM64 hardware" — 15 items,
numbered against the original list.

### Added
- **#1 Virtual desktops** — a real per-desktop window set (not just a
  visual switcher): each open window belongs to exactly one desktop,
  switching desktops shows only that desktop's windows and taskbar
  entries, "+" adds a new one, middle-click closes one (moving its
  windows to the previous desktop), and jumping to an app open on
  another desktop switches you there automatically. Ctrl+Alt+Page
  Up/Down cycles between them.
- **#2 Thirds snapping** — Ctrl+Alt+Left/Right/Down snaps the focused
  window into a left/center/right third of the screen.
- **#3 Taskbar hover previews** — hovering a taskbar icon that
  represents more than one window lists each by title, to jump to a
  specific one instead of only cycling through them.
- **#6 Move to next monitor** — Ctrl+Alt+M moves Anchoran's whole
  window to the next connected physical display.
- **#8 Named window layouts** — save the current arrangement of open
  windows under a name from Task View, and restore it later (reopens
  or repositions each app to match).
- **#9 Keyboard window resize** — Ctrl+Shift+Arrow resizes the focused
  window in fixed steps.
- **#10 Minimize animates to its real taskbar icon** — previously
  animated toward a fixed generic point regardless of which app it
  was.
- **#11 Admin audit log** — Settings → Users (owner-only) now lists
  every Terminal elevation and every admin grant/revoke on this PC,
  not just failed PIN attempts.
- **#12 Admin session idle expiry** — an elevated Administrator
  Terminal left untouched for 10 minutes closes itself automatically.
- **#14 PIN-gated uninstall of protected apps** — default-installed
  apps (not the genuinely core ones — Files, Terminal, Settings, the
  Webstore, which stay permanently unremovable) can now be uninstalled
  with an admin PIN, instead of being flatly blocked. The same PIN
  gate now also protects Settings → Privacy → Reset Anchoran.
- **#16 Sign out** — new Power menu entry that closes every open
  window and returns to the lock screen, without shutting Anchoran
  down.
- **#17 Real encryption of preferences/filesystem at rest** —
  AES-256, keyed by a random key itself protected via Windows DPAPI
  (Electron's safeStorage), so the on-disk store doesn't decrypt
  without that same Windows account. Existing stores are migrated in
  place on first run.
- **#18 Temporary guest mode** — "Continue as Guest" on the lock
  screen starts a throwaway profile that's deleted the moment you
  leave it (switch profile, or sign out). Scope note: guest mode
  resets identity/appearance only — app data (Notes, Files, …) is
  shared across every profile regardless, a pre-existing, documented
  limitation of the whole profiles system, not something guest mode
  changes.
- **#22 Terminal command-name autocomplete** — Tab now completes the
  command itself (built-ins and your own `alias`es), not just a file
  path argument, which already worked.
- **#25 Terminal right-click menu** — Copy (selected text), Paste
  (into the input) and Clear, instead of only keyboard copy/paste.

### Verification
`typecheck`, `build` (renderer + electron) and `test` (7/7) all pass.

## [2.8.7] - 2026-09-12

A second, smaller pass at the same 94-item list, picking up items that
don't need a code-signing certificate or an actual ARM64 machine to
verify (both still blocked, see 2.8.4's entry below).

### Added
- Files: a visible favorite/star indicator on favorited files and
  folders, in both grid and list view — the "Add to Favorites" toggle
  from 2.8.4 had no visual marker of its own until now.
- Window management: "Keep on top" — a per-window pin in the title bar
  that keeps that window rendered above every other, unpinned window
  regardless of focus order (a Calculator or Clock staying visible
  over a maximized app, for example).
- Security/Privacy: clipboard history auto-clear — a new "Clipboard
  auto-clear" setting under Settings → Privacy lets you forget
  clipboard entries after 5 minutes, 30 minutes, 1 hour or 1 day,
  instead of only ever clearing it by hand.
- Launcher: a "Frequently used" row at the top of the app list (shown
  only with an empty search) tracking real open counts per app, so
  the apps you actually use surface before the full alphabetical list.

### Not implemented, still blocked
- Code-signing certificate (Windows SmartScreen warnings) — needs a
  real certificate purchase, not something this session can do.
- Native ARM64 build — needs real ARM64 hardware to verify; building
  blind for an architecture nobody can test here isn't safe to ship.
- The remaining ~80 items from the original 94-item list are still
  open. Two batches in, the highest-value, most self-contained items
  are done; what's left mostly needs either a longer, focused session
  per item (virtual desktops, Files column view, full multi-window
  browser reading mode) or product decisions this session shouldn't
  make alone (which of several competing UI conventions to adopt).

## [2.8.4] - 2026-09-12

A curated batch from a 94-item "what would you improve about the whole
system" list — one real, working item per major area rather than a
shallow pass at all 94 in a single unsupervised sitting. See the
bottom of this entry for what didn't make it and why.

### Added

- **Terminal**: command history now persists across sessions (used to
  reset every time the window closed), and a real `alias` command
  (`alias ll="ls"`, `alias --remove ll`) — aliases also persist and
  expand recursively (bounded) before a line is parsed.
- **Files**: "Batch rename N items…" on a multi-selection — add a
  prefix and/or suffix to every selected item's name at once (suffix
  lands before the extension for files).
- **Launcher**: a tiny built-in calculator — type an arithmetic
  expression (`12 * (4 + 1)`) and the top result shows the answer,
  click or Enter to copy it. A real recursive-descent parser, not
  `eval`.
- **Notifications**: Do Not Disturb can now run on a daily schedule
  (Settings → Notifications → quiet hours) in addition to the manual
  toggle, and each toast/history entry can be snoozed 10 minutes
  instead of only dismissed or kept.
- **Browser**: pin a tab (right-click → Pin tab) to shrink it to an
  icon-only slot at the front of the strip that survives "Close
  others"; the tab strip's right-click menu also gained Duplicate,
  Close others, and Close tabs to the right in one place.
- **Clipboard Manager**: a search box to filter clipboard history
  instead of scrolling through the whole list.
- **Window management**: "Window Spotlight" (Quick Settings) dims
  every window except the focused one instead of hiding them outright
  — a focus mode for working without other windows pulling your eye.
- **Security**: failed lock-screen PIN attempts are now logged with a
  timestamp, visible only to this PC's owner (Settings → Users) — so
  someone trying PINs against your lock screen doesn't go unnoticed.
- **Settings → About**: "Export diagnostics…" bundles the running
  version, real CPU/memory/platform info, and the last 200 log lines
  into one text file you choose where to save — for reporting a bug
  with full context in one click instead of hunting for logs by hand.

### Not implemented from the 94-item list, and why

Roughly 85 items were left for a future pass rather than rushed:
several depend on things outside what a single unsupervised session
can respons­ibly deliver — a real code-signing certificate (needs to be
purchased and configured, not something to fake), an ARM64 build
(needs real ARM hardware to verify, none available here), a rewritten
installer pipeline to meaningfully shrink its size (Electron+Chromium
have a real floor around 150MB regardless). Others are large enough on
their own to deserve their own focused pass rather than a shallow
version squeezed in alongside 9 unrelated ones: virtual desktops,
window-thumbnail previews, a Files column view, real full-text search
across file contents, reading mode/translation in the Browser, and
finishing (or removing) the still-experimental window embedding from
v2.6.14 chief among them. The full 94-item list stays on the table —
ask for any specific one by number and it's a normal, focused task.

## [2.6.18] - 2026-09-12

### Fixed

- `anchoran changeto vX.Y.Z` used to just quit with no cinematic and
  never reopen on its own, leaving the user to relaunch Anchoran by
  hand — now split into a download phase and an install phase: once
  the download finishes, the same fullscreen UpdateTheater every other
  update path uses plays first, and only *then* does it actually run
  the installer, this time with the exact `--updated --force-run`
  arguments electron-updater itself uses for a silent install that
  relaunches the app afterward. `changeto` now looks and behaves
  exactly like a normal update, upgrade or downgrade alike.

## [2.6.17] - 2026-09-12

### Fixed

- Window embedding could still fail to find a real, visible window
  after the previous EnumWindows fix, for two further reasons now
  addressed: many launcher-wrapped or DRM-protected apps spawn a
  separate child process that actually owns the window (sometimes
  after the original process already exited) — the helper now walks
  the whole process tree (CreateToolhelp32Snapshot) for every
  descendant, not just the one process it launched directly, and
  watches whichever process actually owns the found window for exit,
  not necessarily the original one. Also raised the window-wait
  timeout from 15s to 60s — plenty of real games take longer than 15s
  to get through loading/shader compilation before showing anything.

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

## [2.6.12] - 2026-09-12

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
