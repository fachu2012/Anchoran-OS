// Anchoran's crash watchdog — a small, genuinely separate native
// process (NOT a copy of Anchoran's own Electron binary, unlike the
// earlier Node-script version — see Watchdog.csproj) that exists
// entirely OUTSIDE Anchoran's own process, specifically so it can
// still act when Anchoran itself dies outright — an uncaught
// main-process exception, a renderer that never recovers, the whole
// process getting killed — none of which a handler living *inside*
// that same process could ever reliably react to. This is what
// replaced the old in-process React ErrorBoundary: that could only
// ever catch one narrow class of failure (a React render throwing);
// this catches all of them, the same way, in one place.
//
// Always launched through AnchoranLauncher (see native/launcher), which
// reports explorer.exe — not Anchoran — as this process's parent, so it
// keeps running even if Anchoran itself is killed via Task Manager's
// grouped "End task" (which otherwise walks and kills everything it
// displays nested under Anchoran's own process tree, watchdog
// included — the exact bug this whole arrangement exists to survive).
//
// Usage: AnchoranWatchdog.exe <anchoranPid> <execPath> [appEntryDir]
//   appEntryDir is only passed in dev (unpackaged) mode, where
//   relaunching means `electron.exe <projectDir> <flags>` rather than
//   just `<packaged-exe> <flags>` — see electron/main.ts's spawnWatchdog
//   for exactly how these are passed.
//
// Protocol (a Windows named pipe, `\\.\pipe\anchoran-watchdog-<pid>`,
// `<pid>` being Anchoran's own process id — unique per session, so an
// old crashed session's watchdog can never be confused with a fresh
// one's):
//   Anchoran -> watchdog:
//     "PING\n" every ANCHORAN_HEARTBEAT_MS
//     "CRASH:<json>\n" once, immediately before Anchoran's own process
//       ends on purpose because of a fatal error (see main.ts's
//       uncaughtException handler and its "renderer-fatal-error" IPC
//       handler — both funnel into the exact same send)
//     "GRACEFUL\n" once, immediately before Anchoran's own process ends
//       ON PURPOSE and NOT because of an error — the normal "Shut down
//       Anchoran" flow, a Terminal-initiated restart, or answering "n"
//       on the boot confirmation screen (see main.ts's
//       sendGracefulToWatchdogAndThen). Told a real bug via live
//       testing: without this, every one of those completely normal
//       closes still showed the crash screen, since all this process
//       could see from outside was "the pid we're watching just
//       disappeared" — indistinguishable, on its own, from a real crash.
//
// The watchdog reacts to either "CRASH", or the pid actually
// disappearing / PINGs simply stopping (silence past
// HEARTBEAT_TIMEOUT_MS), by:
//   - if a "GRACEFUL" arrived recently and this wasn't itself a "CRASH"
//     (an explicit crash report always wins, however recent):
//     showing "(Shutting down Anchoran…)" on the curtain (see below)
//     for GracefulHoldMs, then quitting cleanly — no relaunch;
//   - otherwise: revealing the curtain immediately, then spawning a
//     fresh Anchoran instance with `--anchoran-crash-screen <message>`,
//     which main.ts recognizes and shows only the crash screen instead
//     of Anchoran's normal desktop — see main.ts's `isCrashScreenMode`.
//
// The "curtain": a plain black, borderless, fullscreen WinForms window
// this process creates once at startup and keeps ready but HIDDEN the
// entire time Anchoran is running normally — never shown, never
// interferes with anything. The moment either reaction above fires,
// showing it is close to instant (the native window already exists;
// there's nothing left to create), which is the whole point: relaunch
// a fresh Anchoran instance for the real, richly-styled crash screen
// takes a few real seconds (a whole new Electron/Chromium process
// cold-booting) — confirmed via live testing as long enough to see the
// bare Windows desktop flash by in between, which is exactly what this
// curtain exists to cover instead.

using System.Diagnostics;
using System.Drawing;
using System.IO.Pipes;
using System.Text;
using System.Windows.Forms;

namespace AnchoranWatchdog;

internal static class Program
{
    private const int HeartbeatTimeoutMs = 15000;
    private const int CheckIntervalMs = 3000;
    private const int GracefulWindowMs = 10000; // how recent a "GRACEFUL" has to be to still count
    private const int GracefulHoldMs = 3000; // how long "(Shutting down Anchoran…)" stays up
    private const int RelaunchHoldMs = 1500; // grace period after spawning the real crash screen, before this process exits

    private static long _lastPingAtTicks = Environment.TickCount64;
    // Set only once the first real "PING" has actually been received —
    // see PollLoopAsync for why the heartbeat-timeout check must not
    // run before that. _lastPingAtTicks alone isn't enough to tell the
    // two cases apart, since it starts at this process's own launch
    // time (a plausible-looking but meaningless "last ping"), not at
    // Anchoran's.
    private static volatile bool _everPinged;
    private static long _lastGracefulAtTicks = -1;
    private static int _done; // 0 = still watching, 1 = already reacted (Interlocked guard)

    private static CurtainForm? _curtain;
    private static readonly ManualResetEventSlim _curtainReady = new(false);

    private static async Task<int> Main(string[] args)
    {
        if (!OperatingSystem.IsWindows())
        {
            Console.Error.WriteLine("This helper only runs on Windows.");
            return 1;
        }
        if (args.Length < 2 || !int.TryParse(args[0], out var anchoranPid))
        {
            Console.Error.WriteLine("Usage: AnchoranWatchdog.exe <anchoranPid> <execPath> [appEntryDir]");
            return 1;
        }
        var execPath = args[1];
        var appEntryDir = args.Length > 2 && args[2].Length > 0 ? args[2] : null;

        var uiThread = new Thread(RunCurtainUiThread) { IsBackground = true };
        uiThread.SetApartmentState(ApartmentState.STA);
        uiThread.Start();
        // The polling/pipe logic below can reveal the curtain the
        // instant it decides to — it must not race ahead of the curtain
        // actually existing yet.
        _curtainReady.Wait();

        var pollTask = Task.Run(() => PollLoopAsync(anchoranPid, execPath, appEntryDir));
        var pipeTask = Task.Run(() => PipeServerLoopAsync(anchoranPid, execPath, appEntryDir));

        await Task.WhenAny(pollTask, pipeTask);

        try
        {
            _curtain?.Invoke(Application.Exit);
        }
        catch
        {
            // The UI thread may already be gone — nothing more to do.
        }
        return 0;
    }

    private static void RunCurtainUiThread()
    {
        try
        {
            ApplicationConfiguration.Initialize();
        }
        catch
        {
            // Older/self-contained publish shapes may not generate this
            // helper — falling back to the manual calls it wraps is fine.
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
        }
        _curtain = new CurtainForm();
        _curtainReady.Set();
        Application.Run(_curtain);
    }

    private static bool IsAnchoranStillRunning(int pid)
    {
        try
        {
            using var proc = Process.GetProcessById(pid);
            return !proc.HasExited;
        }
        catch
        {
            return false;
        }
    }

    private static bool WasRecentlyGraceful()
    {
        var at = Volatile.Read(ref _lastGracefulAtTicks);
        if (at < 0) return false;
        return Environment.TickCount64 - at <= GracefulWindowMs;
    }

    private static async Task PollLoopAsync(int anchoranPid, string execPath, string? appEntryDir)
    {
        while (Volatile.Read(ref _done) == 0)
        {
            await Task.Delay(CheckIntervalMs);
            if (Volatile.Read(ref _done) != 0) return;

            if (!IsAnchoranStillRunning(anchoranPid))
            {
                await React(execPath, appEntryDir, "Anchoran's process ended unexpectedly.");
                return;
            }
            // Before the first real PING ever arrives, _lastPingAtTicks
            // only reflects this watchdog process's OWN start time, not
            // Anchoran's — a false "went silent" reading purely from how
            // long the pipe connection and cold start happen to take
            // (native exe extraction, antivirus scanning a freshly
            // unpacked binary, a slow disk), unrelated to whether
            // Anchoran is actually fine. Confirmed via live testing: it
            // could fire while the user was still simply reading the
            // BIOS confirmation screen, well before typing anything, and
            // wrongly revealed the crash curtain over a perfectly
            // healthy session (the IsAnchoranStillRunning check above is
            // what actually catches a real early death instead).
            if (_everPinged)
            {
                var silentForMs = Environment.TickCount64 - Volatile.Read(ref _lastPingAtTicks);
                if (silentForMs > HeartbeatTimeoutMs)
                {
                    await React(execPath, appEntryDir, "Anchoran stopped responding.");
                    return;
                }
            }
        }
    }

    private static async Task PipeServerLoopAsync(int anchoranPid, string execPath, string? appEntryDir)
    {
        var pipeName = $"anchoran-watchdog-{anchoranPid}";
        while (Volatile.Read(ref _done) == 0)
        {
            // PipeDirection.InOut, not .In — even though this side only
            // ever reads (Anchoran only ever writes to it, never reads
            // anything back): a pipe instance created .In-only grants
            // the connecting client write-only access, and Node's
            // net.createConnection() opens named pipes expecting full
            // read+write access by default, which Windows then denies
            // against a write-only instance — the connection just
            // silently never succeeds. Confirmed via live testing: this
            // is why the watchdog's crash screen never appeared even
            // once, across every version since it was rewritten native.
            using var server = new NamedPipeServerStream(pipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
            try
            {
                await server.WaitForConnectionAsync();
            }
            catch
            {
                continue; // pipe creation/connection hiccup — just try again
            }

            using var reader = new StreamReader(server, Encoding.UTF8, false, 1024, leaveOpen: true);
            try
            {
                string? line;
                while ((line = await reader.ReadLineAsync()) != null)
                {
                    if (Volatile.Read(ref _done) != 0) return;
                    if (line == "PING")
                    {
                        Volatile.Write(ref _lastPingAtTicks, Environment.TickCount64);
                        _everPinged = true;
                    }
                    else if (line == "GRACEFUL")
                    {
                        Volatile.Write(ref _lastGracefulAtTicks, Environment.TickCount64);
                    }
                    else if (line.StartsWith("CRASH:", StringComparison.Ordinal))
                    {
                        var message = ParseCrashMessage(line["CRASH:".Length..]);
                        // An explicit crash report always wins over any
                        // earlier "GRACEFUL" — Anchoran itself is saying
                        // this specific exit IS the crash.
                        await ReactToCrash(execPath, appEntryDir, message);
                        return;
                    }
                }
            }
            catch
            {
                // The client disconnected or the pipe broke — loop back
                // and open a fresh server instance in case it reconnects
                // (mirrors electron/main.ts's own retry-on-error logic on
                // the client side).
            }
        }
    }

    /// <summary>
    /// The shared reaction to "the pid is gone" / "PINGs stopped" —
    /// unlike an explicit "CRASH:" message (see ReactToCrash below),
    /// this is a PASSIVE, external observation with no message
    /// attached, so a recent "GRACEFUL" genuinely changes what it means.
    /// </summary>
    private static async Task React(string execPath, string? appEntryDir, string crashMessage)
    {
        if (Interlocked.Exchange(ref _done, 1) != 0) return;

        if (WasRecentlyGraceful())
        {
            await ShowGracefulShutdownAndQuit();
            return;
        }

        RevealCurtain("");
        RelaunchAsCrashScreen(execPath, appEntryDir, crashMessage);
        await Task.Delay(RelaunchHoldMs);
    }

    /// <summary>An explicit "CRASH:" message from Anchoran itself — always a real crash, regardless of any earlier "GRACEFUL".</summary>
    private static async Task ReactToCrash(string execPath, string? appEntryDir, string message)
    {
        if (Interlocked.Exchange(ref _done, 1) != 0) return;
        RevealCurtain("");
        RelaunchAsCrashScreen(execPath, appEntryDir, message);
        await Task.Delay(RelaunchHoldMs);
    }

    private static async Task ShowGracefulShutdownAndQuit()
    {
        RevealCurtain("(Shutting down Anchoran…)");
        await Task.Delay(GracefulHoldMs);
        // No relaunch — this was Anchoran choosing to close, not a crash.
    }

    private static void RevealCurtain(string statusText)
    {
        try
        {
            _curtain?.Reveal(statusText);
        }
        catch
        {
            // The curtain failing to show is unfortunate but must never
            // block the actual crash-recovery logic (relaunching the
            // real crash screen) from still happening.
        }
    }

    private static string ParseCrashMessage(string jsonPayload)
    {
        // Minimal, dependency-free extraction of {"message":"..."} —
        // this only ever needs to read what electron/main.ts's own
        // sendCrashToWatchdogAndThen() writes, not arbitrary JSON.
        const string key = "\"message\"";
        var keyIndex = jsonPayload.IndexOf(key, StringComparison.Ordinal);
        if (keyIndex < 0) return "Anchoran crashed.";
        var colonIndex = jsonPayload.IndexOf(':', keyIndex + key.Length);
        if (colonIndex < 0) return "Anchoran crashed.";
        var firstQuote = jsonPayload.IndexOf('"', colonIndex + 1);
        if (firstQuote < 0) return "Anchoran crashed.";
        var lastQuote = jsonPayload.IndexOf('"', firstQuote + 1);
        if (lastQuote < 0) return "Anchoran crashed.";
        return jsonPayload[(firstQuote + 1)..lastQuote].Replace("\\\"", "\"").Replace("\\\\", "\\");
    }

    private static void RelaunchAsCrashScreen(string execPath, string? appEntryDir, string message)
    {
        try
        {
            var psi = new ProcessStartInfo(execPath) { UseShellExecute = false };
            if (appEntryDir != null) psi.ArgumentList.Add(appEntryDir);
            psi.ArgumentList.Add("--anchoran-crash-screen");
            psi.ArgumentList.Add(message);
            Process.Start(psi);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"watchdog: failed to relaunch the crash screen: {ex.Message}");
        }
    }
}

/// <summary>
/// A plain black, borderless, fullscreen window — created once at
/// startup and kept hidden until Reveal() is called. See this file's
/// own header comment for why this exists at all (an instant curtain
/// while the real, Electron-rendered crash screen cold-boots).
/// Deliberately not TopMost until the moment it's actually revealed —
/// while hidden, it must never compete with or interfere with Anchoran
/// itself or anything else on the desktop.
/// </summary>
internal sealed class CurtainForm : Form
{
    private readonly Label _label;

    public CurtainForm()
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        BackColor = Color.Black;

        var bounds = Screen.PrimaryScreen?.Bounds ?? new Rectangle(0, 0, 1920, 1080);
        Bounds = bounds;

        _label = new Label
        {
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Color.FromArgb(200, 200, 200),
            BackColor = Color.Black,
            Font = new Font("Segoe UI", 13F, FontStyle.Regular),
            Text = "",
        };
        Controls.Add(_label);
    }

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            // WS_EX_TOOLWINDOW: never shows up in Alt+Tab or the
            // taskbar, even in the moment it's revealed — this is a
            // plain status curtain, not a real app window. Deliberately
            // NOT WS_EX_NOACTIVATE: Reveal() below calls Activate() on
            // purpose (so it's genuinely what's on top, not just drawn
            // on top), and that flag would fight it.
            const int WS_EX_TOOLWINDOW = 0x00000080;
            cp.ExStyle |= WS_EX_TOOLWINDOW;
            return cp;
        }
    }

    /// <summary>Shows this window immediately, on top, with the given status text (empty for a plain black curtain).</summary>
    public void Reveal(string statusText)
    {
        if (InvokeRequired)
        {
            Invoke(() => Reveal(statusText));
            return;
        }
        _label.Text = statusText;
        TopMost = true;
        if (!Visible) Show();
        Activate();
    }
}
