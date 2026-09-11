// Anchoran Kiosk Hook — a tiny standalone helper for Anchoran OS's
// optional "System Mode".
//
// What it does: while running, it installs a Windows low-level
// keyboard hook (WH_KEYBOARD_LL) and swallows exactly two things —
// the Windows key (so Explorer's own Start Menu never opens) and
// Alt+Tab (so Explorer's own task switcher never opens) — printing a
// line to stdout each time so the Electron app that spawned it can
// react with its own Launcher / window switcher instead. Nothing else
// is touched: every other key passes through completely normally.
//
// Safety guarantees this file is written to uphold:
//   - Ctrl+Alt+Delete can never be intercepted by a user-mode hook —
//     that is enforced by Windows itself, not by this code, and stays
//     true no matter what this process does.
//   - This process only ever exists while Anchoran chose to start it,
//     and:
//       1. exits immediately on an "EXIT" command over stdin (the
//          normal shutdown path, from Anchoran's own power menu), or
//       2. exits on its own within ~1s if its parent process (passed
//          as the first argument, Anchoran's PID) is no longer
//          running — so a crash or a forced kill of Anchoran can never
//          leave this hook running with no way to reach it.
//   - No key is ever suppressed unless this process is alive and this
//     exact hook is installed; the moment it exits, Windows
//     immediately regains normal Win-key/Alt+Tab behavior with no
//     further action needed.
//
// stdin protocol (line-based): "EXIT" to shut down cleanly.
// stdout protocol (line-based): "WIN" when the Windows key was
// pressed and swallowed, "ALTTAB" when Alt+Tab was pressed and
// swallowed, "READY" once the hook is installed and listening.

using System.Runtime.InteropServices;

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

    private static int Main(string[] args)
    {
        if (!OperatingSystem.IsWindows())
        {
            Console.Error.WriteLine("This helper only runs on Windows.");
            return 1;
        }

        // Pin stdin/stdout to UTF-8 explicitly rather than whatever
        // console codepage the environment defaults to — the parent
        // (Node's child_process) always writes/reads UTF-8, and a
        // mismatched encoding here would corrupt the "EXIT" line just
        // enough that the string comparison below silently never
        // matches, leaving this process running with no visible error.
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

        // PostQuitMessage only ever affects the CALLING thread's own
        // message queue — every Win32 thread has its own — so the
        // stdin-reader and watchdog threads below (which are not the
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

        Console.WriteLine("READY");
        Console.Out.Flush();

        var stdinThread = new Thread(() =>
        {
            string? line;
            while ((line = Console.In.ReadLine()) != null)
            {
                if (line.Trim().Equals("EXIT", StringComparison.OrdinalIgnoreCase))
                {
                    NativeMethods.PostThreadMessageW(mainThreadId, WM_QUIT, 0, 0);
                    break;
                }
            }
        })
        { IsBackground = true };
        stdinThread.Start();

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

        NativeMethods.UnhookWindowsHookEx(_hookHandle);
        return 0;
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
                Console.WriteLine("WIN");
                Console.Out.Flush();
                return 1; // Swallow — Explorer's Start Menu never sees it.
            }

            if (info.vkCode == VK_TAB && (NativeMethods.GetAsyncKeyState(VK_MENU) & 0x8000) != 0)
            {
                Console.WriteLine("ALTTAB");
                Console.Out.Flush();
                return 1; // Swallow — Explorer's task switcher never sees it.
            }
        }

        return NativeMethods.CallNextHookEx(_hookHandle, nCode, wParam, lParam);
    }
}

internal static partial class NativeMethods
{
    public delegate nint LowLevelKeyboardProc(int nCode, nint wParam, nint lParam);

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
}
