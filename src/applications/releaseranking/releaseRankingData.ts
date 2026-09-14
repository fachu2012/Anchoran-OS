/**
 * The data behind the "Release Ranking" app — kept in sync by hand
 * with the same-named published Artifact (see the memory note about
 * this: every CHANGELOG entry should also touch this file, adding the
 * new version's row and, if it closes a bug that was "open" in earlier
 * rows, correcting those rows' descriptions).
 *
 * Each row: [version, date, score 1-10, "what shipped" (may contain
 * simple inline HTML — <code class="inline">, <b>, <span
 * class="clean">), "what's still open if you stayed on this version"].
 * Scores and "still open" wording follow the same methodology as the
 * Artifact: for each version, which bugs documented by some *later*
 * version's own "Fixed" section were already introduced but not yet
 * fixed at that exact point, weighted by severity, alongside how
 * complete the app already was.
 */
export type RankingRow = [version: string, date: string, score: number, what: string, bugs: string];

export const RANKING_ROWS: RankingRow[] = [
  ["3.5.5", "2026-09-14", 9, "A trivial version bump on top of everything v3.5.4 shipped — no functional changes of its own, exists purely as a real next I.P.U. to test the new custom update provider's I.P.U.-to-I.P.U. auto-detection from within Anchoran itself.", "no known open bugs at this point — still I.P.U.-only as of this update"],
  ["3.5.4", "2026-09-14", 9, "On top of everything v3.5.0–v3.5.3 already shipped: a custom update provider fixes I.P.U.-to-I.P.U. auto-detection (electron-updater's own logic could only ever find the next stable release from an I.P.U.); a per-plugin \"Auto-update\" toggle updates a Webstore plugin right before it opens, with an \"Updating…\" screen; <code class='inline'>anchoran apps/uninstall/open/install</code> now see Webstore plugins, not just bundled apps; a plugin installed before manifest.json existed (e.g. Anchoran Code Studio) no longer shows up in the Launcher as its raw id; Code Studio can be uninstalled like any other plugin; and the Browser's secondary toolbar moves into a \"⋮\" menu.", "no known open bugs at this point — never got a stable release of its own; folds into v3.5.5 instead"],
  ["3.5.3", "2026-09-14", 9, "On top of everything v3.5.0–v3.5.2 already shipped: fixes <code class='inline'>anchoran changeto</code> 404ing on every I.P.U. install and the taskbar not reappearing over a maximized window; a plugin can now request its own window size (<code class='inline'>preferredSize</code>); installed Webstore plugins now show up in the Launcher (and disappear on uninstall); and the taskbar's right-click menu always offers \"New window\" first.", "no known open bugs at this point — never got a stable release of its own; folds into v3.5.4 instead"],
  ["3.5.2", "2026-09-14", 9, "On top of everything v3.5.0/v3.5.1 already shipped: the Release Ranking gains sort/filter controls (by score or date, or narrowed to one score band); the Webstore's Community section gains a category filter and each plugin's own short changelog in its detail view; and <b>Anchoran Code Studio</b> gains starter templates (Empty App, Counter, Task List) for New Project.", "no known open bugs at this point — never got a stable release of its own; folds into v3.5.3 instead"],
  ["3.5.1", "2026-09-14", 9, "The Release Ranking gains a \"best pick per Windows-era comparison\" row on top of everything v3.5.0 already shipped: the Webstore drops its own bundled-apps catalog (only Community and the new \"My Creations\", for local <b>Anchoran Code Studio</b> projects, are left), apps installed by default can no longer be uninstalled at all, Community plugins show their author, the Release Ranking shows modern versions with their real \"Build-#H#.#\" label, and a new <code class='inline'>sdk.openApp</code> lets a plugin open another Anchoran window.", "no known open bugs at this point — never got a stable release of its own; folds into v3.5.2 instead"],
  ["3.5.0", "2026-09-14", 9, "The Webstore stops browsing Anchoran's own bundled apps entirely — only Community (real plugins) and the new \"My Creations\" (local <b>Anchoran Code Studio</b> projects) are left, since nothing else was ever really \"from\" the Webstore. Apps installed by default can no longer be uninstalled at all (the old admin-PIN override is gone). Community plugins show their author; the Release Ranking itself shows modern versions with their real \"Build-#H#.#\" label; a new <code class='inline'>sdk.openApp</code> lets a plugin open another Anchoran window.", "no known open bugs at this point — never got a stable release of its own; folds into v3.5.1 instead"],
  ["3.4.0", "2026-09-14", 9, "45 bundled utility/game apps move out to standalone Webstore plugins (28 ported 1:1, 17 fused into 8 richer plugins — Chance, Text Tools, Converter, Password Tools, Recorder, Draw Studio, Image Tools, Tasks & Reminders), every 2-player game gains a bot opponent, and a new one-time \"Anchoran Local Apps\" notice tells anyone updating with one of the removed apps installed exactly what's leaving and what replaces it. Also: Code Runner (Files now runs a code file instead of opening it for editing), a live preview + real thumbnails for image files, PDFs open in Quick Look instead of your Windows browser, Files' Quick Links no longer get redirected into OneDrive, and a Changelog button in the Webstore reading the Anchoran-Webstore repo's own release notes.", "no known open bugs at this point — closes the Webstore-catalog-\"Offline\" bug open since v3.1.2"],
  ["2.6.18", "2026-09-12", 8, "<code class='inline'>anchoran changeto</code> no longer leaves the app closed with nothing to reopen it — it now runs the same UpdateTheater cinematic every other update path uses, with the exact silent-install arguments electron-updater itself uses.", "1 open, scoped to the embed: window detection — unchanged since v2.6.17"],
  ["2.6.17", "2026-09-12", 8, "The newest at the time. Everything else closed; the experimental embed is the only thing still unconfirmed.", "1 open, scoped: the embed — final outcome still unconfirmed"],
  ["2.8.4", "2026-09-12", 8, "Batch rename, persistent Terminal aliases, a Launcher calculator, scheduled DND, tab pinning, Window Spotlight, failed-PIN logging, exportable diagnostics.", "1 open, scoped: same embed bug, unchanged — closes only in v2.9.0"],
  ["2.8.7", "2026-09-12", 8, "Visible favorites, \"Keep on top\", clipboard auto-clear, \"Frequently used\" in the Launcher.", "1 open, scoped: same embed bug"],
  ["2.9.7", "2026-09-13", 9, "Fixes the markdown renderer (What's New used to look like a tower of one-line blocks), adds Anchover (Anchoran's own <code class='inline'>winver</code>), renames \"Beta channel\" to \"Insider Preview updates\".", "no known open bugs at this point"],
  ["2.9.8", "2026-09-13", 9, "Just removes the redundant \"Continue as Guest\" button — Guest already shows up as its own profile tile on the lock screen.", "no known open bugs at this point"],
  ["2.6.13", "2026-09-12", 10, "All of 2.6.x's security, permissions, Task View and commands already in.", "<span class='clean'>zero known open bugs</span> — the only point in the whole history like that"],
  ["2.6.12", "2026-09-12", 9, "One step back: same security state, without the Terminal's last focus polish.", "<span class='clean'>zero known open bugs</span>"],
  ["2.3.0", "2026-09-12", 8, "Screenshot/Magnifier/Recorder just fixed, ~12 more improvements — but <code class='inline'>sudo</code> doesn't exist yet (it's born in 2.5.0).", "1 open, obscure: <code class='inline'>autoInstallOnAppQuit</code> — fixed in v2.6.12"],
  ["2.4.0", "2026-09-12", 8, "Browser fully done (tabs, history, downloads, PDF).", "1 open, obscure: <code class='inline'>autoInstallOnAppQuit</code> — fixed in v2.6.12"],
  ["2.6.11", "2026-09-12", 8, "The <code class='inline'>sudo</code> command — Terminal admin with no PIN — just got removed. The project's most serious hole, closed.", "1 open, obscure: <code class='inline'>autoInstallOnAppQuit</code> — fixed in v2.6.12, next up"],
  ["2.6.14", "2026-09-12", 8, "Everything from 2.6.13 plus an experimental Windows app embed — opt-in: if you never touch it, it doesn't affect you.", "1 open, scoped to the embed: window detection fails — nothing else in the app is affected"],
  ["2.6.15", "2026-09-12", 8, "Same as above, with better error handling when the embed fails.", "1 open, scoped: the embed's window detection, still not fully resolved"],
  ["2.6.16", "2026-09-12", 8, "Same — one more attempt at fixing detection, not enough.", "1 open, scoped: same embed bug, confirmed to persist"],
  ["3.0.1", "2026-09-13", 6, "Attempts to fix the bug above with a real semver suffix on the I.P.U. build (<code class='inline'>-IPU</code>) — a real improvement (I.P.U.-to-I.P.U. update chaining does work from here on), but not the full fix it was meant to be.", "2 open: the \"ready to install\" screen showed the raw version instead of the proper label (closes in v3.0.2), and — not discovered until later — a device on this build with Insider Preview updates enabled still couldn't detect the stable release, since electron-updater's own logic doesn't recognize a custom \"-IPU\" identifier as a walkable prerelease channel (real fix in v3.1.2)"],
  ["3.0.3", "2026-09-13", 6, "Fixes the stuck update banner and finishes clearing the old plain \"vX.Y.Z\" versioning out of every place that should already use the new one.", "2 open: <code class='inline'>anchoran changeto</code> still didn't show or let you install I.P.U. releases (closes v3.0.4), and an Insider Preview device still couldn't detect the stable release with the toggle left on (real fix v3.1.2)"],
  ["3.0.4", "2026-09-13", 7, "<code class='inline'>anchoran changeto</code> now lists and installs I.P.U. releases (short names too, \"Build #H#.#\") and guards a downgrade past v2.9.2 behind a mandatory data-wipe confirmation; this very app is born, preinstalled and unremovable; Guest can no longer open the Terminal at all; the taskbar background is noticeably more translucent.", "1 open: an Insider Preview device on this build still couldn't detect the stable v3.0.4 release with the toggle left on — a device that switched Insider Preview updates off did correctly detect it, which is what actually surfaced this bug (real fix v3.1.2)"],
  ["3.1.2", "2026-09-13", 8, "The real fix for the Insider-Preview-can't-detect-stable bug: the internal semver suffix an I.P.U. build's version.json carries is now \"-beta\" instead of \"-IPU\", which is what electron-updater's own logic actually recognizes as a walkable prerelease channel (nothing user-facing changes — the tag, release name and \"I.P.U.\" badge stay the same). Also narrows the full \"Version # | Build #H#.#\" label down to exactly three places (the release name, the update-ready screen's title, Anchover); everywhere else now uses a compact \"Build-#H#.#\" form.", "1 open, introduced by this very fix: the Webstore's own app catalog panel showed \"Offline\" on every I.P.U. build from here on, since its GitHub release lookup was built from the new \"-beta\" suffix instead of the real \"-IPU\" tag and 404'd every time — closes in v3.4.0"],
  ["3.3.6", "2026-09-13", 8, "Third-party plugin apps land: a new Anchoran App SDK (<code class='inline'>window.AnchoranSDK</code>) and a privileged <code class='inline'>anchoran-plugin://</code> protocol let the Webstore's new Community section download and run real plugin apps from a separate, independently-versioned repo — no Anchoran OS release needed to publish or update one. The Webstore now also shows Anchoran OS's own version in its sidebar.", "1 open, inherited from v3.1.2: the Webstore's app catalog panel still showed \"Offline\" on I.P.U. builds — closes in v3.4.0. The plugin system itself is a new, deliberately small pilot (one SDK version, one example plugin), not yet broadly exercised"],
  ["1.7.0", "2026-09-11", 7, "Fixes restore-then-re-minimize. Still before the big app waves, so that backlog doesn't exist yet.", "no serious known bugs at this point — just few apps"],
  ["1.8.0", "2026-09-11", 7, "Browser downloads + a Files editor — both work fine, even though they're later replaced by something better.", "no serious known bugs at this point"],
  ["3.0.0", "2026-09-13", 7, "The two-stage system (I.P.U./stable) and the new \"Version # | Build #H#.#\" versioning are born — good new infrastructure.", "1 open, narrowly scoped: a device already on this version's I.P.U. build would never automatically detect the stable release even with Insider Preview updates enabled — v3.0.1's own attempt at fixing this doesn't fully work either; the real fix isn't until v3.1.2 (toggling Insider Preview updates off works around it in the meantime)"],
  ["3.0.2", "2026-09-13", 6, "Fixes the raw label on the install screen and recategorizes the previous update's type from \"critical\" to \"stability\", a fairer fit.", "3 open: the pending-update banner could stay stuck on screen even after a check that said \"up to date\" (closes v3.0.3), the GitHub release description still showed plain \"vX.Y.Z\" (closes v3.0.3), and an Insider Preview device still couldn't detect the stable release with the toggle left on (real fix v3.1.2)"],
  ["1.3.0", "2026-09-11", 6, "The project's worst bug (Settings saving nothing) just got fixed — but very few apps still.", "non-silent update installation (fixed in v1.2.3, earlier — already closed)"],
  ["1.3.1", "2026-09-11", 6, "The Launcher shortcut is already Ctrl+Alt+L, same as today. Settings already saves.", "no serious known bugs at this point"],
  ["1.9.0", "2026-09-11", 6, "Webstore with a versioned catalog — still before the big app waves (1.10 onward).", "\"Open with…\" starts to matter and doesn't work well yet (real fix in v2.1.12)"],
  ["1.12.0", "2026-09-11", 6, "Multi-select, Quick Settings, accessibility — solid, already a respectable feature set.", "Open with… + the 1.10 app backlog (QR Code)"],
  ["1.13.0", "2026-09-11", 6, "Print to PDF, auto-lock, documented shortcuts.", "same backlog as 1.12.0, no new bugs"],
  ["2.2.0", "2026-09-12", 6, "Own file picker + 6 app bugs closed in one pass (chess, dates, terminal, notes, QR, solitaire).", "Screenshot/Magnifier/Recorder still open (fixed in v2.3.0) + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["2.2.1", "2026-09-12", 6, "Files now opens every file type with the right app.", "Screenshot/Magnifier/Recorder + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["2.2.2", "2026-09-12", 6, "A real <code class='inline'>&lt;webview&gt;</code> crash just got patched.", "Screenshot/Magnifier/Recorder + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["2.9.6", "2026-09-13", 6, "Fixes 6 inherited UX bugs in one pass (deleting your own profile with no confirmation, EPERM restoring from a drive root, Rename broken in list view, columns with no context menu and unsorted, the Recycle Bin icon opened Windows' own, windows with no minimum size), redesigns Guest Mode as a permanent profile, unifies the clock and notifications.", "1 open, cosmetic: the markdown renderer turned every wrapped line into its own paragraph (What's New and the Notes preview looked bad) — closes in v2.9.7"],
  ["1.6.0", "2026-09-11", 5, "Onboarding just born, the Launcher shortcut already stable.", "update installs with no cinematic, active since day one (fix far away, v2.6.12)"],
  ["1.10.0", "2026-09-11", 5, "11 apps at once — QR Code is born with its own error-handling bug.", "QR Code with no error handling (fixed in v2.2.0) + non-silent install already closed"],
  ["1.11.0", "2026-09-11", 5, "System sound stops being mute — the app set is still small.", "QR Code open"],
  ["1.14.0", "2026-09-11", 5, "7 new apps — Habit Tracker is born with the UTC date bug.", "QR Code + Habit-Tracker-UTC-date (both close in v2.2.0)"],
  ["2.1.12", "2026-09-11", 5, "10 standard OS features (Recycle Bin, search, OSK…), \"Open with…\" finally properly fixed.", "the full Wave 5–8 backlog: UTC date, chess, solitaire, screenshot, magnifier, recorder — close in v2.2.0/v2.3.0"],
  ["2.1.13", "2026-09-11", 5, "Group events by the minute in Event Viewer.", "same 8-app-bug backlog as 2.1.12"],
  ["2.9.2", "2026-09-13", 5, "The real, complete fix for this whole boot-crash saga — Anchoran reliably boots again on any PC. Only from here is the app genuinely installable again.", "6 known, inherited UX bugs: deleting your own profile asks for no confirmation, EPERM restoring from a drive root, Rename broken in list view (the default one), columns with no context menu and unsorted, the Recycle Bin icon still opens Windows' own, windows with no minimum size — all close together only in v2.9.6"],
  ["1.2.3", "2026-09-11", 4, "Update installs are silent now.", "Settings still saves nothing — the project's worst bug, still active"],
  ["1.2.4", "2026-09-11", 4, "Just a CI fix (releases were staying in draft).", "Settings still saves nothing"],
  ["1.3.2", "2026-09-11", 4, "Switches the shortcut to Ctrl+Win — Windows still wins that fight on some PCs.", "the shortcut chosen here isn't reliable either (fixed in v1.6.0) + non-silent install already closed"],
  ["1.4.0", "2026-09-11", 4, "The Webstore is born + 3 small apps.", "update installs with no cinematic, active since day one"],
  ["1.5.0", "2026-09-11", 4, "UpdateTheater and UpdateReadyScreen are born — the base of today's flow.", "same silent-install-with-no-cinematic bug, root cause still not found"],
  ["2.1.8", "2026-09-11", 4, "System Mode + multiple profiles just born — a solid base.", "Open with…, QR Code, + the full Wave 5–8 set of 8 bugs"],
  ["2.5.0", "2026-09-12", 4, "3 excellent fixes (lock-screen leak, menu listener, CSS across 12+ apps) — but <code class='inline'>sudo</code> is born: admin Terminal with no prompt at all.", "<code class='inline'>sudo</code> (serious, just born) + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["1.15.0", "2026-09-11", 3, "6 apps at once — 3 are born with a bug (chess, date, solitaire) the same day.", "5 app bugs open, just introduced here"],
  ["1.16.0", "2026-09-11", 3, "4 more apps — the Wave 6 backlog stays fully open.", "same 5-bug backlog, unchanged"],
  ["1.17.0", "2026-09-11", 3, "6 more apps — Screenshot now shows up in its own captures.", "6 app bugs open (adds Screenshot)"],
  ["1.19.0", "2026-09-11", 3, "System Mode — a good feature, doesn't touch the app backlog.", "8 app bugs open, the peak"],
  ["1.19.1", "2026-09-11", 3, "Fixes the Windows-key shortcut crash.", "8 app bugs open + the same crash briefly reappears in 2.0.0"],
  ["1.18.1", "2026-09-11", 3, "Just the app's real icon — cosmetic.", "8 app bugs open, the historic peak"],
  ["2.0.0", "2026-09-11", 3, "A real filesystem replaces the virtual one — a huge change, doesn't touch the app-bug backlog.", "8 inherited app bugs + a transient Win-shortcut crash (same release)"],
  ["2.1.6", "2026-09-11", 3, "Reverts 3 rushed decisions from 2.0.0.", "8 inherited app bugs, untouched"],
  ["2.1.7", "2026-09-11", 3, "Fixes Files' '&lt;' button — targeted, the big backlog remains.", "8 inherited app bugs"],
  ["2.1.9", "2026-09-11", 3, "Photos and Zip Tool installed by default.", "8 app bugs + Open with… still broken"],
  ["2.1.10", "2026-09-11", 3, "17 icons + Quick Look — Quick Look is born with its own zip-size bug.", "9 app bugs open"],
  ["2.1.11", "2026-09-11", 3, "Notes fixed — but \"Open with…\" is declared fixed here and is actually still broken.", "9 bugs, including an Open with… that looks closed but isn't"],
  ["2.5.1", "2026-09-12", 3, "Its own scrollbars and focus rings — the new ring marks text boxes wrong.", "<code class='inline'>sudo</code> + <code class='inline'>autoInstallOnAppQuit</code> + focus ring on inputs"],
  ["2.5.2", "2026-09-12", 3, "Notifications now auto-dismiss correctly.", "<code class='inline'>sudo</code> still active + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["2.6.6", "2026-09-12", 3, "Five real UI fixes — none touch the underlying problem.", "<code class='inline'>sudo</code> still active + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["2.6.9", "2026-09-12", 3, "Terminal no longer spams lines; Settings' button now tries to respect the cinematic.", "<code class='inline'>sudo</code> still active + the real root cause of the cinematic skip"],
  ["2.6.10", "2026-09-12", 3, "Single-instance lock — windows no longer stack up.", "<code class='inline'>sudo</code> still active (12th version in a row) + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["1.18.0", "2026-09-11", 2, "The original plan's last 3 apps — the app-bug backlog hits its peak.", "8 simultaneous app bugs: UTC date, chess, solitaire, QR, zip sizes, screenshot, magnifier, recorder"],
  ["1.0.0", "2026-09-11", 2, "Functionally identical to alpha.6 — only the number changes.", "Settings saves nothing (serious) + non-silent update installs"],
  ["1.1.0", "2026-09-11", 2, "Boot/shutdown cinematics — same bug state as 1.0.0.", "Settings saves nothing (serious) + non-silent installs"],
  ["1.2.0", "2026-09-11", 2, "The \"ready to install\" screen is just born.", "Settings saves nothing (serious) + non-silent installs"],
  ["1.2.1", "2026-09-11", 2, "Boot redesigned — and accidentally commits junk to the repo along the way.", "Settings saves nothing (serious), still unfixed"],
  ["1.2.2", "2026-09-11", 2, "Cleans up what 1.2.1 had committed by mistake.", "Settings saves nothing (serious), still"],
  ["2.6.0", "2026-09-12", 2, "The very version that documents <code class='inline'>sudo</code> in the Terminal's help — more visible than ever.", "<code class='inline'>sudo</code> (now documented) + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["2.6.1", "2026-09-12", 2, "Visual polish — doesn't touch security.", "<code class='inline'>sudo</code> + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["2.6.2", "2026-09-12", 2, "One more admin Terminal command — more surface on a system with <code class='inline'>sudo</code> wide open.", "<code class='inline'>sudo</code> + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["2.6.3", "2026-09-12", 2, "The *real* permissions system (a real PIN) is born — but <code class='inline'>sudo</code>, the insecure shortcut, stays active in parallel.", "<code class='inline'>sudo</code> + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["2.6.4", "2026-09-12", 2, "Colored icons everywhere — cosmetic.", "<code class='inline'>sudo</code> + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["2.6.5", "2026-09-12", 2, "Launcher redesigned — and a new context-menu bug is born.", "<code class='inline'>sudo</code>, <code class='inline'>autoInstallOnAppQuit</code>, the Launcher's context menu (fixed in v2.6.6)"],
  ["2.6.7", "2026-09-12", 2, "<code class='inline'>anchoran changeto</code> now installs real versions — with <code class='inline'>sudo</code> active, that's total control with no PIN.", "<code class='inline'>sudo</code>, <code class='inline'>autoInstallOnAppQuit</code>, progress spam during downloads"],
  ["2.6.8", "2026-09-12", 2, "Task View + copying text in Terminal.", "<code class='inline'>sudo</code> + <code class='inline'>autoInstallOnAppQuit</code>"],
  ["1.0.0-alpha.4", "2026-09-11", 2, "Unified taskbar, lock-screen PIN, backup/restore — huge, but every Settings toggle forgets itself on restart.", "Settings persists absolutely nothing — the project's worst bug"],
  ["1.0.0-alpha.3", "2026-09-11", 1, "Disk persistence is just born — and born broken: it saves whole functions instead of data.", "Settings saves nothing at all — fixed only in v1.3.0, many versions later"],
  ["1.0.0-alpha.5", "2026-09-11", 1, "Real auto-update for the first time — with a non-silent install and Settings still broken, all three at once.", "Settings-saves-nothing (serious) + non-silent install + <code class='inline'>autoInstallOnAppQuit</code> dangerous from day one"],
  ["2.8.9", "2026-09-12", 1, "<b>Release disabled.</b> Brings real encryption of preferences/filesystem — but the migrator builds the encrypted Store directly on top of a file that's still plaintext: on any PC with prior data, that blows up with an uncaught <code class='inline'>SyntaxError</code> and Anchoran never boots again.", "guaranteed crash on the next restart on any install with prior data — the real fix arrives 3 versions later, in v2.9.2"],
  ["2.8.12", "2026-09-12", 1, "<b>Release disabled.</b> Terminal tabs, a Files column view, its own Trash, folder compare — all on top of the same unresolved boot crash.", "same boot crash as v2.8.9, unfixed"],
  ["2.8.15", "2026-09-12", 1, "<b>Release disabled.</b> A fully keyboard-driven Launcher, theme presets, rotating wallpaper, power profiles.", "same boot crash, unfixed"],
  ["2.8.18", "2026-09-12", 1, "<b>Release disabled.</b> Tab groups, reading mode, translation, markdown Notes, week/day Calendar view.", "same boot crash, unfixed"],
  ["2.9.0", "2026-09-13", 1, "<b>Release disabled.</b> Closes the last 10 items of the 94-item list — repeatable reminders, a Vault generator, a smaller installer, tests 7→34 — all on top of the same broken boot.", "same boot crash, unfixed"],
  ["2.9.1", "2026-09-13", 1, "<b>Release disabled.</b> The first attempt at fixing the boot crash — real, but incomplete: it still crashed on the second restart of any session.", "the boot crash persists (the real cause is only identified and closed in v2.9.2)"],
  ["1.0.0-alpha.2", "2026-09-11", 4, "Dark mode and animations — introduces the restore-then-re-minimize bug.", "restoring a window re-minimizes it on its own (fixed in v1.7.0)"],
  ["1.0.0-alpha.1", "2026-09-11", 6, "Initial scaffold: 8 apps, a virtual filesystem. Not much, but what's there works.", "no known bugs yet — nothing's broken because almost nothing exists"],
];

/** Loose, era-by-era analogy (not a literal feature mapping) to a real Windows release, matching the lede's own "picking Windows 7 over 10/11" framing. */
export function windowsEquivalent(v: string): string {
  if (v.includes("alpha")) return "Windows 1.0";
  const base = v.split("-")[0];
  const [ma, mi, pa] = base.split(".").map(Number);
  const cmp = (b: string) => {
    const [bma, bmi, bpa] = b.split(".").map(Number);
    return ma !== bma ? ma - bma : mi !== bmi ? mi - bmi : pa - bpa;
  };
  if (cmp("3.0.0") >= 0) return "Windows 11";
  if (cmp("2.9.2") >= 0) return "Windows 10";
  if (cmp("2.8.9") >= 0) return "Windows Vista";
  if (cmp("2.6.11") >= 0) return "Windows 7";
  if (cmp("2.5.0") >= 0) return "Windows XP (no Service Pack)";
  if (cmp("2.2.0") >= 0) return "Windows XP SP2";
  if (cmp("2.0.0") >= 0) return "Windows 8";
  if (cmp("1.18.0") >= 0) return "Windows Me";
  if (cmp("1.10.0") >= 0) return "Windows 98";
  if (cmp("1.6.0") >= 0) return "Windows 95";
  if (cmp("1.3.0") >= 0) return "Windows 3.1";
  return "Windows 2.0";
}

/** Every windowsEquivalent() output, in the order its own if-chain checks them — newest/best-regarded Anchoran era first. */
export const WINDOWS_ERA_ORDER = [
  "Windows 11",
  "Windows 10",
  "Windows Vista",
  "Windows 7",
  "Windows XP (no Service Pack)",
  "Windows XP SP2",
  "Windows 8",
  "Windows Me",
  "Windows 98",
  "Windows 95",
  "Windows 3.1",
  "Windows 2.0",
] as const;

export interface BestPerEraEntry {
  windowsEra: string;
  row: RankingRow;
}

/**
 * For each Windows-equivalent era, the single best-scoring Anchoran
 * version that falls into it (ties broken by whichever comes first in
 * RANKING_ROWS, which is itself already sorted best-to-worst by the
 * ranking UI) — "if you had to pick one Anchoran release to represent
 * this whole era, which is it". Skips any era nothing in RANKING_ROWS
 * actually maps to.
 */
export function bestPerWindowsEra(rows: RankingRow[]): BestPerEraEntry[] {
  const byEra = new Map<string, RankingRow>();
  for (const row of rows) {
    const era = windowsEquivalent(row[0]);
    const current = byEra.get(era);
    if (!current || row[2] > current[2]) byEra.set(era, row);
  }
  return WINDOWS_ERA_ORDER.filter((era) => byEra.has(era)).map((era) => ({ windowsEra: era, row: byEra.get(era)! }));
}
