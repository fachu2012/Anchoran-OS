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
// One-shot by design: it does exactly one job — watch, then react
// once — and exits. A relaunched Anchoran (via "Restart Anchoran" on
// the crash screen, or a normal fresh launch) spawns its own new
// watchdog for its own new session; nothing here needs to keep
// running past the moment it's already done its job.
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
//   Anchoran -> watchdog: "PING\n" every ANCHORAN_HEARTBEAT_MS, and
//     "CRASH:<json>\n" once, immediately before Anchoran's own process
//     ends on purpose because of a fatal error (see main.ts's
//     uncaughtException handler and its "renderer-fatal-error" IPC
//     handler — both funnel into the exact same send).
// The watchdog reacts to either "CRASH" or PINGs simply stopping
// (silence past HEARTBEAT_TIMEOUT_MS, or the pid confirmed gone) by
// spawning a fresh Anchoran instance with `--anchoran-crash-screen
// <message>`, which main.ts recognizes and shows only the crash
// screen instead of Anchoran's normal desktop — see main.ts's
// `isCrashScreenMode`.

using System.Diagnostics;
using System.IO.Pipes;
using System.Text;

namespace AnchoranWatchdog;

internal static class Program
{
    private const int HeartbeatTimeoutMs = 15000;
    private const int CheckIntervalMs = 3000;

    private static long _lastPingAtTicks = Environment.TickCount64;
    private static int _done; // 0 = still watching, 1 = already reacted (Interlocked guard)

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

        var pollTask = Task.Run(() => PollLoopAsync(anchoranPid, execPath, appEntryDir));
        var pipeTask = Task.Run(() => PipeServerLoopAsync(anchoranPid, execPath, appEntryDir));

        await Task.WhenAny(pollTask, pipeTask);
        return 0;
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

    private static async Task PollLoopAsync(int anchoranPid, string execPath, string? appEntryDir)
    {
        while (Volatile.Read(ref _done) == 0)
        {
            await Task.Delay(CheckIntervalMs);
            if (Volatile.Read(ref _done) != 0) return;

            if (!IsAnchoranStillRunning(anchoranPid))
            {
                RelaunchAsCrashScreen(execPath, appEntryDir, "Anchoran's process ended unexpectedly.");
                return;
            }
            var silentForMs = Environment.TickCount64 - Volatile.Read(ref _lastPingAtTicks);
            if (silentForMs > HeartbeatTimeoutMs)
            {
                RelaunchAsCrashScreen(execPath, appEntryDir, "Anchoran stopped responding.");
                return;
            }
        }
    }

    private static async Task PipeServerLoopAsync(int anchoranPid, string execPath, string? appEntryDir)
    {
        var pipeName = $"anchoran-watchdog-{anchoranPid}";
        while (Volatile.Read(ref _done) == 0)
        {
            using var server = new NamedPipeServerStream(pipeName, PipeDirection.In, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
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
                    }
                    else if (line.StartsWith("CRASH:", StringComparison.Ordinal))
                    {
                        var message = ParseCrashMessage(line["CRASH:".Length..]);
                        RelaunchAsCrashScreen(execPath, appEntryDir, message);
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

    private static string ParseCrashMessage(string jsonPayload)
    {
        // Minimal, dependency-free extraction of {"message":"..."} —
        // this only ever needs to read what electron/main.ts's own
        // sendCrashToWatchdog() writes, not arbitrary JSON.
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
        if (Interlocked.Exchange(ref _done, 1) != 0) return;

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
