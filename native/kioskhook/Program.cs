// Anchoran Kiosk Hook — a tiny standalone helper for Anchoran OS's
// System Mode (unconditional since the BootConfirmGate the user
// agrees to on every launch — see src/boot/BootConfirmGate.tsx).
//
// What it does, on top of the keyboard hook described below: the
// moment it starts, it takes an inventory of every OTHER real,
// currently-visible top-level window on the desktop (never
// Anchoran's own, never something already hidden/minimized-to-tray
// before Anchoran even started), hides each one (SW_HIDE — the
// window and its process both keep running completely normally,
// nothing is closed) and drops its owning process to
// IDLE_PRIORITY_CLASS (near-zero CPU, not suspended/frozen). On
// exit — by ANY path, see the safety guarantees below — every one of
// those exact windows is shown again and every one of those exact
// processes has its real original priority restored, using the
// inventory taken at startup, never a blind "unhide everything" that
// could touch a window the user had a real reason to keep hidden on
// their own.
//
// It also installs a Windows low-level keyboard hook (WH_KEYBOARD_LL)
// and swallows exactly two things — the Windows key (so Explorer's
// own Start Menu never opens) and Alt+Tab (so Explorer's own task
// switcher never opens) — printing a line to stdout each time so the
// Electron app that spawned it can react with its own Launcher /
// window switcher instead. Nothing else is touched: every other key
// passes through completely normally.
//
// Safety guarantees this file is written to uphold:
//   - Ctrl+Alt+Delete can never be intercepted by a user-mode hook —
//     that is enforced by Windows itself, not by this code, and stays
//     true no matter what this process does. Neither can the real
//     Sign out from that screen: it tears down the whole session,
//     this process included, unconditionally.
//   - This process only ever exists while Anchoran chose to start it,
//     and:
//       1. exits immediately on an "EXIT" command over stdin (the
//          normal shutdown path, from Anchoran's own power menu), or
//       2. exits on its own within ~1s if its parent process (passed
//          as the first argument, Anchoran's PID) is no longer
//          running — so a crash or a forced kill of Anchoran can never
//          leave this hook running, or every other app hidden/
//          throttled with no way to bring them back.
//   - Both exit paths above ALWAYS restore every window/process this
//     process touched before it actually quits — see RestoreAll().
//   - No key is ever suppressed unless this process is alive and this
//     exact hook is installed; the moment it exits, Windows
//     immediately regains normal Win-key/Alt+Tab behavior with no
//     further action needed.
//
// Talks to Anchoran over a Windows named pipe
// (`\\.\pipe\anchoran-kioskhook-<anchoranPid>`), not stdin/stdout.
// Line-based protocol, same shape as the crash watchdog's own pipe
// (see native/watchdog/Program.cs): this process sends "READY" once
// the hook is installed and the takeover is done, "WIN" whenever the
// Windows key is pressed and swallowed, "ALTTAB" whenever Alt+Tab is
// pressed and swallowed; Anchoran sends "EXIT" to ask for a clean
// shutdown.
//
// This was a plain stdin/stdout protocol before — broken by
// native/launcher's own reparenting trick (see that file's own
// comments): once kioskhook started being spawned through
// AnchoranLauncher instead of directly, in v3.8.1 (when System Mode
// became unconditional and kioskhook started running every session),
// the launcher's attempt to forward its own inherited stdio handles
// two hops deep turned out not to reliably carry kioskhook's stdout
// back to Anchoran — the Windows key stopped opening the Launcher on
// every version since, since Anchoran was blind to every "WIN" line
// kioskhook still sent. A named pipe is a direct connection between
// this process and Anchoran, with no intermediary process (the
// launcher exits the instant it creates kioskhook) whose own handle
// inheritance behavior it depends on.
//
// This is talking to Anchoran's main process just like the crash
// watchdog does. kioskhook is the ONLY consumer/producer of this pipe
// (Anchoran connects as the client) — nothing about the reparenting
// itself changes; only the channel used to talk back to Anchoran does.

using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;

namespace AnchoranKioskHook;

internal static class Program
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int VK_LWIN = 0x5B;
    private const int VK_RWIN = 0x5C;
    private const int VK_TAB = 0x09;
    private const int VK_MENU = 0x12; // Alt (either side)

    private const uint WM_QUIT = 0x0012;

    private static nint _hookHandle;
    // Kept as a static field so the delegate is never garbage-collected
    // while the unmanaged hook still holds a reference to it.
    private static readonly NativeMethods.LowLevelKeyboardProc HookProcDelegate = HookProc;

    // Exactly the windows/processes this run hid/throttled — restored
    // from this list and nothing else, see TakeOverDesktop/RestoreAll.
    private static readonly List<nint> _hiddenWindows = new();
    private static readonly Dictionary<int, uint> _throttledProcessOriginalPriority = new();
    private static int _restoreGuard; // Interlocked flag: RestoreAll runs at most once, even if both exit paths race.

    private static NamedPipeServerStream? _pipeServer;
    private static StreamWriter? _pipeWriter;
    private static readonly object _pipeWriteLock = new();

    private static int Main(string[] args)
    {
        if (!OperatingSystem.IsWindows())
        {
            Console.Error.WriteLine("This helper only runs on Windows.");
            return 1;
        }

        // PostQuitMessage only ever affects the CALLING thread's own
        // message queue — every Win32 thread has its own — so the
        // pipe-server and watchdog threads below (which are not the
        // thread running the GetMessage loop) must instead post WM_QUIT
        // directly to this thread's queue by id.
        var mainThreadId = NativeMethods.GetCurrentThreadId();

        int? parentPid = args.Length > 0 && int.TryParse(args[0], out var pid) ? pid : null;

        var moduleHandle = NativeMethods.GetModuleHandle(null);
        _hookHandle = NativeMethods.SetWindowsHookExW(WH_KEYBOARD_LL, HookProcDelegate, moduleHandle, 0);
        if (_hookHandle == 0)
        {
            Console.Error.WriteLine("Failed to install the keyboard hook.");
            return 1;
        }

        TakeOverDesktop(parentPid);

        var pipeThread = new Thread(() => RunPipeServer(parentPid, mainThreadId)) { IsBackground = true };
        pipeThread.Start();

        if (parentPid is int pidValue)
        {
            var watchdog = new Thread(() => WatchParent(pidValue, mainThreadId)) { IsBackground = true };
            watchdog.Start();
        }

        // Standard Win32 message pump — required for a low-level
        // keyboard hook to actually receive events.
        while (NativeMethods.GetMessageW(out var msg, 0, 0, 0))
        {
            NativeMethods.TranslateMessage(in msg);
            NativeMethods.DispatchMessageW(in msg);
        }

        RestoreAll();
        NativeMethods.UnhookWindowsHookEx(_hookHandle);
        return 0;
    }

    /// <summary>
    /// Hides every other real, currently-visible top-level window and
    /// throttles its owning process — see this file's own header for
    /// exactly what counts as "real" and why. Building the inventory
    /// (_hiddenWindows / _throttledProcessOriginalPriority) as we go is
    /// what makes RestoreAll() exact instead of a blind "show
    /// everything" that could also un-hide something the user had a
    /// real reason to keep hidden before Anchoran ever started.
    /// </summary>
    private static void TakeOverDesktop(int? anchoranPid)
    {
        var currentPid = Environment.ProcessId;
        // Anchoran itself only ever occupies the PRIMARY display (see
        // createMainWindow() in electron/main.ts, always
        // screen.getPrimaryDisplay()) — on a multi-monitor setup, a
        // window on any OTHER monitor is left completely alone (never
        // hidden, never throttled): Anchoran doesn't cover that screen,
        // so hiding what's already there would just leave that whole
        // monitor blank for no reason instead of still being usable.
        // Point (0,0) is always on the primary monitor by Windows'
        // own convention, so MonitorFromPoint there reliably gets its
        // handle without needing Anchoran's own window handle.
        var primaryMonitor = NativeMethods.MonitorFromPoint(default, NativeMethods.MONITOR_DEFAULTTOPRIMARY);
        NativeMethods.EnumWindows((hwnd, _) =>
        {
            if (!NativeMethods.IsWindowVisible(hwnd)) return true; // already hidden on its own — leave it alone
            if (NativeMethods.GetWindow(hwnd, NativeMethods.GW_OWNER) != 0) return true; // a popup/tool window, not a real top-level app window
            if (NativeMethods.GetWindowTextLengthW(hwnd) == 0) return true; // no titlebar text — not a real user-facing window
            if (NativeMethods.MonitorFromWindow(hwnd, NativeMethods.MONITOR_DEFAULTTONEAREST) != primaryMonitor) return true; // on a different monitor than Anchoran — leave it alone

            NativeMethods.GetWindowThreadProcessId(hwnd, out var ownerPid);
            if (ownerPid == 0) return true;
            var ownerPidInt = unchecked((int)ownerPid);
            // Never touch Anchoran's own windows, or (belt-and-suspenders,
            // in case a window somehow reports pid 0/itself oddly) this
            // helper's own process.
            if (ownerPidInt == anchoranPid || ownerPidInt == currentPid) return true;

            NativeMethods.ShowWindow(hwnd, NativeMethods.SW_HIDE);
            _hiddenWindows.Add(hwnd);

            if (!_throttledProcessOriginalPriority.ContainsKey(ownerPidInt))
            {
                var procHandle = NativeMethods.OpenProcess(
                    NativeMethods.PROCESS_SET_INFORMATION | NativeMethods.PROCESS_QUERY_LIMITED_INFORMATION,
                    false,
                    ownerPid
                );
                if (procHandle != 0)
                {
                    var originalPriority = NativeMethods.GetPriorityClass(procHandle);
                    if (originalPriority != 0)
                    {
                        _throttledProcessOriginalPriority[ownerPidInt] = originalPriority;
                        NativeMethods.SetPriorityClass(procHandle, NativeMethods.IDLE_PRIORITY_CLASS);
                    }
                    NativeMethods.CloseHandle(procHandle);
                }
                // OpenProcess/GetPriorityClass failing (a protected system
                // process, insufficient rights, …) just leaves that one
                // process at its normal priority — its window is still
                // hidden above, which is the part that actually matters
                // for "Anchoran has the whole screen".
            }
            return true;
        }, 0);
    }

    /// <summary>
    /// Undoes exactly what TakeOverDesktop() did — shows every window
    /// it hid and restores every process's real original priority.
    /// Called from the single fallthrough point both real exit paths
    /// (an "EXIT" command, or the parent-process watchdog) share, so
    /// this always runs before the process actually quits. Idempotent
    /// (via _restoreGuard) since nothing about correctness depends on
    /// it running more than once.
    /// </summary>
    private static void RestoreAll()
    {
        if (Interlocked.Exchange(ref _restoreGuard, 1) != 0) return;

        foreach (var hwnd in _hiddenWindows)
        {
            NativeMethods.ShowWindow(hwnd, NativeMethods.SW_SHOW);
        }
        _hiddenWindows.Clear();

        foreach (var (pid, originalPriority) in _throttledProcessOriginalPriority)
        {
            var procHandle = NativeMethods.OpenProcess(NativeMethods.PROCESS_SET_INFORMATION, false, unchecked((uint)pid));
            if (procHandle != 0)
            {
                NativeMethods.SetPriorityClass(procHandle, originalPriority);
                NativeMethods.CloseHandle(procHandle);
            }
        }
        _throttledProcessOriginalPriority.Clear();
    }

    /// <summary>
    /// Hosts the named pipe Anchoran connects to as a client (see this
    /// file's header for why this replaced a plain stdin/stdout
    /// protocol) — blocks this background thread waiting for that
    /// connection, then reads "EXIT" lines from it exactly like the old
    /// stdin thread did, while HookProc (via WritePipeLine) writes
    /// "WIN"/"ALTTAB" lines out the other direction as they happen.
    /// </summary>
    private static void RunPipeServer(int? anchoranPid, uint mainThreadId)
    {
        var pipeName = anchoranPid is int pid ? $"anchoran-kioskhook-{pid}" : "anchoran-kioskhook";
        try
        {
            _pipeServer = new NamedPipeServerStream(pipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.None);
            _pipeServer.WaitForConnection();
            _pipeWriter = new StreamWriter(_pipeServer, Encoding.UTF8) { AutoFlush = true };
            WritePipeLine("READY");

            using var reader = new StreamReader(_pipeServer, Encoding.UTF8, false, 1024, leaveOpen: true);
            string? line;
            while ((line = reader.ReadLine()) != null)
            {
                if (line.Trim().Equals("EXIT", StringComparison.OrdinalIgnoreCase))
                {
                    NativeMethods.PostThreadMessageW(mainThreadId, WM_QUIT, 0, 0);
                    break;
                }
            }
        }
        catch
        {
            // The pipe never connecting, or breaking later, isn't this
            // thread's job to react to further — WatchParent's own
            // pid-based poll is the real safety net for "Anchoran died"
            // regardless of this channel's state; an "EXIT" that can
            // never arrive this way just means RestoreAll() only ever
            // happens via that path (or the message loop ending some
            // other way) instead.
        }
    }

    private static void WritePipeLine(string line)
    {
        lock (_pipeWriteLock)
        {
            try
            {
                _pipeWriter?.WriteLine(line);
            }
            catch
            {
                // Best-effort — a broken pipe here just means this one
                // signal is lost, not a reason to crash the hook.
            }
        }
    }

    private static void WatchParent(int parentPid, uint mainThreadId)
    {
        while (true)
        {
            Thread.Sleep(1000);
            try
            {
                var proc = System.Diagnostics.Process.GetProcessById(parentPid);
                if (proc.HasExited) break;
            }
            catch (ArgumentException)
            {
                break; // No process with that id anymore.
            }
        }
        NativeMethods.PostThreadMessageW(mainThreadId, WM_QUIT, 0, 0);
    }

    private static nint HookProc(int nCode, nint wParam, nint lParam)
    {
        if (nCode >= 0 && (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN))
        {
            var info = Marshal.PtrToStructure<NativeMethods.KBDLLHOOKSTRUCT>(lParam);

            if (info.vkCode == VK_LWIN || info.vkCode == VK_RWIN)
            {
                WritePipeLine("WIN");
                return 1; // Swallow — Explorer's Start Menu never sees it.
            }

            if (info.vkCode == VK_TAB && (NativeMethods.GetAsyncKeyState(VK_MENU) & 0x8000) != 0)
            {
                WritePipeLine("ALTTAB");
                return 1; // Swallow — Explorer's task switcher never sees it.
            }
        }

        return NativeMethods.CallNextHookEx(_hookHandle, nCode, wParam, lParam);
    }
}

internal static partial class NativeMethods
{
    public delegate nint LowLevelKeyboardProc(int nCode, nint wParam, nint lParam);
    public delegate bool EnumWindowsProc(nint hWnd, nint lParam);

    public const uint GW_OWNER = 4;
    public const int SW_HIDE = 0;
    public const int SW_SHOW = 5;
    public const uint PROCESS_SET_INFORMATION = 0x0200;
    public const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    public const uint IDLE_PRIORITY_CLASS = 0x00000040;
    public const uint MONITOR_DEFAULTTOPRIMARY = 1;
    public const uint MONITOR_DEFAULTTONEAREST = 2;

    [StructLayout(LayoutKind.Sequential)]
    public struct KBDLLHOOKSTRUCT
    {
        public int vkCode;
        public int scanCode;
        public int flags;
        public int time;
        public nint dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG
    {
        public nint hwnd;
        public uint message;
        public nint wParam;
        public nint lParam;
        public uint time;
        public POINT pt;
    }

    [LibraryImport("user32.dll", SetLastError = true)]
    public static partial nint SetWindowsHookExW(int idHook, LowLevelKeyboardProc lpfn, nint hMod, uint dwThreadId);

    [LibraryImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool UnhookWindowsHookEx(nint hhk);

    [LibraryImport("user32.dll")]
    public static partial nint CallNextHookEx(nint hhk, int nCode, nint wParam, nint lParam);

    [LibraryImport("kernel32.dll", EntryPoint = "GetModuleHandleW", StringMarshalling = StringMarshalling.Utf16)]
    public static partial nint GetModuleHandle(string? lpModuleName);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool GetMessageW(out MSG lpMsg, nint hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [LibraryImport("user32.dll")]
    public static partial nint TranslateMessage(in MSG lpMsg);

    [LibraryImport("user32.dll")]
    public static partial nint DispatchMessageW(in MSG lpMsg);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool PostThreadMessageW(uint idThread, uint msg, nint wParam, nint lParam);

    [LibraryImport("kernel32.dll")]
    public static partial uint GetCurrentThreadId();

    [LibraryImport("user32.dll")]
    public static partial short GetAsyncKeyState(int vKey);

    [LibraryImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool EnumWindows(EnumWindowsProc lpEnumFunc, nint lParam);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool IsWindowVisible(nint hWnd);

    [LibraryImport("user32.dll")]
    public static partial nint GetWindow(nint hWnd, uint uCmd);

    [LibraryImport("user32.dll", EntryPoint = "GetWindowTextLengthW")]
    public static partial int GetWindowTextLengthW(nint hWnd);

    [LibraryImport("user32.dll")]
    public static partial uint GetWindowThreadProcessId(nint hWnd, out uint lpdwProcessId);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool ShowWindow(nint hWnd, int nCmdShow);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    public static partial nint OpenProcess(uint dwDesiredAccess, [MarshalAs(UnmanagedType.Bool)] bool bInheritHandle, uint dwProcessId);

    [LibraryImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool CloseHandle(nint hObject);

    [LibraryImport("kernel32.dll")]
    public static partial uint GetPriorityClass(nint hProcess);

    [LibraryImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool SetPriorityClass(nint hProcess, uint dwPriorityClass);

    [LibraryImport("user32.dll")]
    public static partial nint MonitorFromWindow(nint hWnd, uint dwFlags);

    [LibraryImport("user32.dll")]
    public static partial nint MonitorFromPoint(POINT pt, uint dwFlags);
}
