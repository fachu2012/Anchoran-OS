// Anchoran Window Embed — a tiny standalone helper that launches a
// real external Windows app and reparents its main window into
// Anchoran's own window, so it renders inside an Anchoran "window"
// frame instead of floating separately on the desktop.
//
// Honest limitation, stated once here rather than pretended away: the
// embedded window is a REAL Win32 window compositing directly on top
// of the screen, not something drawn inside Anchoran's own Chromium
// surface. That means it will always render above every other
// Anchoran UI element in the region it occupies — other Anchoran
// windows dragged over it, menus, drag/resize previews — regardless
// of on-screen stacking order in Anchoran's own UI. This process only
// hides it (SHOW/HIDE over stdin) when its Anchoran window is
// minimized or closed; it does not attempt pixel-perfect occlusion
// clipping against other Anchoran windows, which would need a real
// compositor (DirectComposition) to do properly.
//
// Usage: AnchoranWindowEmbed.exe <exePath> <parentHwndDecimal>
//
// stdout protocol (line-based):
//   READY                — helper started, waiting for the target's window
//   EMBEDDED <hwnd>       — the target window was found and reparented
//   CLOSED                — the target process exited on its own
//   ERROR <message>       — launch failed, or no window appeared in time
//
// stdin protocol (line-based):
//   BOUNDS <x> <y> <w> <h>  — reposition/resize the embedded window
//                              (coordinates are client-relative to the
//                              parent, i.e. exactly what a DOM element's
//                              getBoundingClientRect() already reports
//                              inside Anchoran's own single window)
//   SHOW / HIDE             — toggle visibility (minimize/restore, or
//                              covering it while occlusion can't be
//                              modeled properly)
//   FOCUS                   — bring the embedded window to the front
//   EXIT                    — detach and quit; the target app itself
//                              keeps running, now as a normal floating
//                              window again (best effort — see below)

using System.Diagnostics;
using System.Runtime.InteropServices;

namespace AnchoranWindowEmbed;

internal static class Program
{
    private const int GWL_STYLE = -16;
    private const int GWL_EXSTYLE = -20;

    private const int WS_CAPTION = 0x00C00000;
    private const int WS_THICKFRAME = 0x00040000;
    private const int WS_SYSMENU = 0x00080000;
    private const int WS_MINIMIZEBOX = 0x00020000;
    private const int WS_MAXIMIZEBOX = 0x00010000;
    private const int WS_POPUP = unchecked((int)0x80000000);
    private const int WS_CHILD = 0x40000000;

    private const int WS_EX_DLGMODALFRAME = 0x00000001;
    private const int WS_EX_CLIENTEDGE = 0x00000200;
    private const int WS_EX_STATICEDGE = 0x00020000;
    private const int WS_EX_APPWINDOW = 0x00040000;

    private const uint SWP_NOZORDER = 0x0004;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_FRAMECHANGED = 0x0020;

    private const int SW_HIDE = 0;
    private const int SW_SHOWNOACTIVATE = 4;

    // Generous on purpose: plenty of real games take well over 15s to
    // get past shader compilation / asset loading / a launcher screen
    // before their actual window shows up, and there was no cost to
    // waiting longer beyond the user seeing "Starting…" a bit longer.
    private const int WindowWaitTimeoutMs = 60000;
    private const int WindowPollIntervalMs = 150;

    private static nint _childHwnd;

    private static int Main(string[] args)
    {
        if (!OperatingSystem.IsWindows())
        {
            Console.Error.WriteLine("This helper only runs on Windows.");
            return 1;
        }

        try
        {
            Console.InputEncoding = System.Text.Encoding.UTF8;
            Console.OutputEncoding = System.Text.Encoding.UTF8;
        }
        catch (IOException)
        {
            // Not attached to a real console/pipe that allows changing
            // the encoding — safe to continue with the default.
        }

        if (args.Length < 2 || !long.TryParse(args[1], out var parentHwndValue))
        {
            Console.WriteLine("ERROR Usage: AnchoranWindowEmbed.exe <exePath> <parentHwnd>");
            return 1;
        }

        var exePath = args[0];
        var parentHwnd = (nint)parentHwndValue;

        Console.WriteLine("READY");
        Console.Out.Flush();

        Process process;
        try
        {
            process = Process.Start(new ProcessStartInfo(exePath) { UseShellExecute = true })!;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR Couldn't launch {exePath}: {ex.Message}");
            return 1;
        }

        nint mainHandle = 0;
        var deadline = Environment.TickCount64 + WindowWaitTimeoutMs;
        try
        {
            process.WaitForInputIdle(5000);
        }
        catch (InvalidOperationException)
        {
            // Not a GUI app with a message loop yet, or already idle —
            // the polling loop below is the real wait regardless.
        }
        // Not just this one process id: plenty of real apps — games
        // especially, behind a launcher/bootstrapper/DRM wrapper — spawn
        // a separate child process that owns the actual window, often
        // after the original process has already exited. Re-walking the
        // process tree each tick (via CreateToolhelp32Snapshot) picks up
        // children that appear partway through the wait, and the loop
        // deliberately never bails early just because the original
        // process exited — its children keep running independently of it.
        while (Environment.TickCount64 < deadline)
        {
            var candidatePids = new HashSet<uint> { (uint)process.Id };
            foreach (var pid in GetDescendantPids((uint)process.Id)) candidatePids.Add(pid);
            // Deliberately NOT Process.MainWindowHandle: it uses a
            // narrow heuristic (first visible top-level window with a
            // non-empty title, picked at a specific moment) that many
            // real GUI apps — games especially, with an engine splash
            // window, a borderless/undecorated main window, or a title
            // set after the window is first shown — simply never
            // satisfy, even though a perfectly real window is on
            // screen. A direct EnumWindows scan finds it regardless of
            // title or timing.
            mainHandle = FindWindowForProcesses(candidatePids);
            if (mainHandle != 0) break;
            Thread.Sleep(WindowPollIntervalMs);
        }

        if (mainHandle == 0)
        {
            Console.WriteLine($"ERROR No window appeared for {Path.GetFileName(exePath)} within {WindowWaitTimeoutMs / 1000}s.");
            return 1;
        }

        _childHwnd = mainHandle;
        // The window's own process is the one to actually watch for
        // exit below — not necessarily the one Process.Start() returned,
        // since a launcher/bootstrapper process (see above) can have
        // already exited well before this point while its child (the
        // real, still-running app) owns the embedded window.
        NativeMethods.GetWindowThreadProcessId(_childHwnd, out var ownerPid);
        Process ownerProcess;
        try
        {
            ownerProcess = Process.GetProcessById((int)ownerPid);
        }
        catch (ArgumentException)
        {
            ownerProcess = process;
        }

        // Strip the title bar/frame and any "this is a real top-level
        // window" chrome, then reparent — Anchoran's own window frame
        // (drawn in the DOM) takes over playing the part of a title
        // bar/border from here on.
        //
        // Every one of these three calls can fail silently — Win32
        // returns 0/NULL on failure and nothing throws — so each is
        // checked explicitly now. The single most common real cause of
        // "the app launches fine but never actually ends up embedded"
        // is SetParent failing due to UIPI (User Interface Privilege
        // Isolation): Windows refuses to let a process reparent a
        // window that belongs to a DIFFERENT integrity level (e.g. the
        // target auto-elevated to admin while Anchoran itself did
        // not) — previously this failed completely silently and
        // "EMBEDDED" was reported anyway, which is exactly what made
        // this bug so hard to even notice was happening.
        Marshal.SetLastSystemError(0);
        var style = NativeMethods.GetWindowLongW(_childHwnd, GWL_STYLE);
        style &= ~(WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_POPUP);
        style |= WS_CHILD;
        if (NativeMethods.SetWindowLongW(_childHwnd, GWL_STYLE, style) == 0 && Marshal.GetLastWin32Error() != 0)
        {
            ReportEmbedFailure("SetWindowLong(GWL_STYLE)");
            return 1;
        }

        var exStyle = NativeMethods.GetWindowLongW(_childHwnd, GWL_EXSTYLE);
        exStyle &= ~(WS_EX_DLGMODALFRAME | WS_EX_CLIENTEDGE | WS_EX_STATICEDGE | WS_EX_APPWINDOW);
        NativeMethods.SetWindowLongW(_childHwnd, GWL_EXSTYLE, exStyle);

        Marshal.SetLastSystemError(0);
        if (NativeMethods.SetParent(_childHwnd, parentHwnd) == 0)
        {
            ReportEmbedFailure("SetParent");
            return 1;
        }
        NativeMethods.SetWindowPos(_childHwnd, 0, 0, 0, 0, 0, SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);

        Console.WriteLine($"EMBEDDED {_childHwnd}");
        Console.Out.Flush();

        var exiting = false;

        var watchdog = new Thread(() =>
        {
            ownerProcess.WaitForExit();
            if (!exiting) Console.WriteLine("CLOSED");
            Environment.Exit(0);
        })
        { IsBackground = true };
        watchdog.Start();

        string? line;
        while ((line = Console.In.ReadLine()) != null)
        {
            var trimmed = line.Trim();
            if (trimmed.Equals("EXIT", StringComparison.OrdinalIgnoreCase))
            {
                exiting = true;
                Detach();
                break;
            }
            if (trimmed.Equals("SHOW", StringComparison.OrdinalIgnoreCase))
            {
                NativeMethods.ShowWindow(_childHwnd, SW_SHOWNOACTIVATE);
            }
            else if (trimmed.Equals("HIDE", StringComparison.OrdinalIgnoreCase))
            {
                NativeMethods.ShowWindow(_childHwnd, SW_HIDE);
            }
            else if (trimmed.Equals("FOCUS", StringComparison.OrdinalIgnoreCase))
            {
                NativeMethods.SetForegroundWindow(_childHwnd);
            }
            else if (trimmed.StartsWith("BOUNDS ", StringComparison.OrdinalIgnoreCase))
            {
                var parts = trimmed[7..].Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 4
                    && int.TryParse(parts[0], out var x)
                    && int.TryParse(parts[1], out var y)
                    && int.TryParse(parts[2], out var w)
                    && int.TryParse(parts[3], out var h))
                {
                    NativeMethods.SetWindowPos(_childHwnd, 0, x, y, w, h, SWP_NOZORDER | SWP_NOACTIVATE);
                }
            }
        }

        // stdin closed without an EXIT line — Anchoran itself went away
        // (crash or force-kill). Best-effort detach so the embedded app
        // isn't left as a borderless, unmovable orphan.
        if (!exiting) Detach();
        return 0;
    }

    // Scans every top-level window on the desktop for one owned by any
    // of the given process ids, visible, and preferring one with an
    // actual title over an untitled one — but accepting any visible
    // window rather than requiring a title at all, since plenty of
    // real apps (games especially) never set one.
    private static nint FindWindowForProcesses(HashSet<uint> pids)
    {
        nint found = 0;
        var foundTitleLength = -1;
        NativeMethods.EnumWindows(
            (hWnd, _) =>
            {
                NativeMethods.GetWindowThreadProcessId(hWnd, out var windowPid);
                if (!pids.Contains(windowPid) || !NativeMethods.IsWindowVisible(hWnd))
                {
                    return true; // keep enumerating
                }
                var titleLength = NativeMethods.GetWindowTextLengthW(hWnd);
                if (titleLength > foundTitleLength)
                {
                    found = hWnd;
                    foundTitleLength = titleLength;
                }
                return true;
            },
            0);
        return found;
    }

    // Walks the whole system's process tree (CreateToolhelp32Snapshot —
    // .NET has no built-in "get child processes" API) to find every
    // descendant of the given pid, direct or not. A launcher/
    // bootstrapper/DRM-wrapped game's real window very often belongs to
    // a child process it spawned and not to the process Anchoran itself
    // launched, sometimes after that original process has already exited.
    private static List<uint> GetDescendantPids(uint rootPid)
    {
        var childrenByParent = new Dictionary<uint, List<uint>>();
        var snapshot = NativeMethods.CreateToolhelp32Snapshot(NativeMethods.TH32CS_SNAPPROCESS, 0);
        if (snapshot == nint.Zero || snapshot == new nint(-1)) return [];
        try
        {
            var entry = new NativeMethods.PROCESSENTRY32 { dwSize = (uint)Marshal.SizeOf<NativeMethods.PROCESSENTRY32>() };
            if (NativeMethods.Process32FirstW(snapshot, ref entry))
            {
                do
                {
                    if (!childrenByParent.TryGetValue(entry.th32ParentProcessID, out var list))
                    {
                        list = [];
                        childrenByParent[entry.th32ParentProcessID] = list;
                    }
                    list.Add(entry.th32ProcessID);
                } while (NativeMethods.Process32NextW(snapshot, ref entry));
            }
        }
        finally
        {
            NativeMethods.CloseHandle(snapshot);
        }

        var result = new List<uint>();
        var queue = new Queue<uint>();
        queue.Enqueue(rootPid);
        var visited = new HashSet<uint> { rootPid };
        while (queue.Count > 0)
        {
            if (!childrenByParent.TryGetValue(queue.Dequeue(), out var children)) continue;
            foreach (var child in children)
            {
                if (!visited.Add(child)) continue;
                result.Add(child);
                queue.Enqueue(child);
            }
        }
        return result;
    }

    /// <summary>
    /// Reports why reparenting failed, with the real Win32 error code —
    /// specifically calling out UIPI (integrity-level mismatch) since
    /// it's by far the most common real cause, so the message is
    /// actionable instead of a bare error number.
    /// </summary>
    private static void ReportEmbedFailure(string apiName)
    {
        var errorCode = Marshal.GetLastWin32Error();
        var hint = errorCode == 5 // ERROR_ACCESS_DENIED
            ? " — this usually means the target app is running at a higher privilege level than Anchoran (e.g. it auto-elevated to Administrator); Windows blocks reparenting across integrity levels (UIPI), with no way around it short of running Anchoran itself elevated too."
            : "";
        Console.WriteLine($"ERROR {apiName} failed (Win32 error {errorCode}){hint}");
        Console.Out.Flush();
    }

    private static void Detach()
    {
        if (_childHwnd == 0) return;
        try
        {
            NativeMethods.SetParent(_childHwnd, 0);
            var style = NativeMethods.GetWindowLongW(_childHwnd, GWL_STYLE);
            style &= ~WS_CHILD;
            style |= WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX;
            NativeMethods.SetWindowLongW(_childHwnd, GWL_STYLE, style);
            NativeMethods.SetWindowPos(_childHwnd, 0, 0, 0, 0, 0, SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
            NativeMethods.ShowWindow(_childHwnd, SW_SHOWNOACTIVATE);
        }
        catch
        {
            // Best effort only — if the target already closed or the
            // handle is otherwise invalid, there's nothing left to fix.
        }
    }
}

internal static partial class NativeMethods
{
    [LibraryImport("user32.dll", SetLastError = true)]
    public static partial nint SetParent(nint hWndChild, nint hWndNewParent);

    [LibraryImport("user32.dll", EntryPoint = "GetWindowLongW", SetLastError = true)]
    public static partial int GetWindowLongW(nint hWnd, int nIndex);

    [LibraryImport("user32.dll", EntryPoint = "SetWindowLongW", SetLastError = true)]
    public static partial int SetWindowLongW(nint hWnd, int nIndex, int dwNewLong);

    [LibraryImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool SetWindowPos(nint hWnd, nint hWndInsertAfter, int x, int y, int cx, int cy, uint uFlags);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool ShowWindow(nint hWnd, int nCmdShow);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool SetForegroundWindow(nint hWnd);

    public delegate bool EnumWindowsProc(nint hWnd, nint lParam);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool EnumWindows(EnumWindowsProc lpEnumFunc, nint lParam);

    [LibraryImport("user32.dll")]
    public static partial uint GetWindowThreadProcessId(nint hWnd, out uint lpdwProcessId);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool IsWindowVisible(nint hWnd);

    [LibraryImport("user32.dll", EntryPoint = "GetWindowTextLengthW")]
    public static partial int GetWindowTextLengthW(nint hWnd);

    public const uint TH32CS_SNAPPROCESS = 0x00000002;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct PROCESSENTRY32
    {
        public uint dwSize;
        public uint cntUsage;
        public uint th32ProcessID;
        public nint th32DefaultHeapID;
        public uint th32ModuleID;
        public uint cntThreads;
        public uint th32ParentProcessID;
        public int pcPriClassBase;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string szExeFile;
    }

    // PROCESSENTRY32's fixed-size string field isn't something
    // LibraryImport's source-generated marshaling supports directly —
    // plain DllImport (the classic, fully general P/Invoke marshaler)
    // handles it the same way it always has.
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern nint CreateToolhelp32Snapshot(uint dwFlags, uint th32ProcessID);

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool Process32FirstW(nint hSnapshot, ref PROCESSENTRY32 lppe);

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool Process32NextW(nint hSnapshot, ref PROCESSENTRY32 lppe);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool CloseHandle(nint hObject);
}
