// Anchoran Launcher — a tiny, short-lived helper whose only job is to
// start ANOTHER process (kioskhook or the crash watchdog) with a
// DIFFERENT reported parent process than itself.
//
// Why this exists: Anchoran spawns both kioskhook (hides/throttles
// other apps) and the crash watchdog as real child processes of its
// own main process. Windows records "who created this process" as a
// static property at creation time — it never changes, even if the
// real creator later exits. Windows 11's Task Manager, when you "End
// task" on an app's expanded process tree, walks and terminates every
// process it displays nested under that tree — which includes BOTH
// helpers, even though they're separate .exe files, simply because
// they still report Anchoran's own process as their parent. That
// defeats the entire point of both helpers: they exist specifically
// to survive Anchoran dying, including a forced kill like this one.
//
// The fix: launch the real target with its PARENT reported as
// explorer.exe instead of Anchoran — a well-established, legitimate
// Win32 technique (PROC_THREAD_ATTRIBUTE_PARENT_PROCESS via
// CreateProcess's extended startup info), the same mechanism real
// long-lived background tools use to detach from a launcher that
// might not outlive them. explorer.exe is the natural choice: for any
// real interactive desktop session it's essentially always running,
// and it certainly outlives Anchoran by definition. Once launched
// this way, Task Manager shows the target nested under Explorer (or
// standalone), never under Anchoran — "End task" on Anchoran's own
// tree can no longer reach it.
//
// Usage: AnchoranLauncher.exe <targetExePath> [args...]
// This process stays alive for as long as the target it launched does
// — see LaunchWithParent's doc comment for exactly why — and exits
// with that same exit code once the target finally does. It also
// forwards its own stdin/stdout/stderr straight through to the
// target, so a caller that talks to the target over stdio (kioskhook's
// WIN/ALTTAB lines and its EXIT command, specifically) sees no
// difference from launching it directly. If reparenting fails for any
// reason (no explorer.exe found, the API call itself fails), it falls
// back to a normal launch rather than not starting the target at all —
// a normal (still Anchoran-child) launch is strictly better than no
// launch, even though it reopens the exact bug this exists to fix.

using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace AnchoranLauncher;

internal static class Program
{
    private static int Main(string[] args)
    {
        if (!OperatingSystem.IsWindows())
        {
            Console.Error.WriteLine("This helper only runs on Windows.");
            return 1;
        }
        if (args.Length < 1)
        {
            Console.Error.WriteLine("Usage: AnchoranLauncher.exe <targetExePath> [args...]");
            return 1;
        }

        var targetExe = args[0];
        var targetArgs = args[1..];

        var explorerProc = Process.GetProcessesByName("explorer").FirstOrDefault();
        if (explorerProc == null)
        {
            Console.Error.WriteLine("Couldn't find explorer.exe to reparent onto — falling back to a normal launch.");
            return LaunchNormallyAndWait(targetExe, targetArgs);
        }

        var parentHandle = NativeMethods.OpenProcess(NativeMethods.PROCESS_CREATE_PROCESS, false, (uint)explorerProc.Id);
        if (parentHandle == 0)
        {
            Console.Error.WriteLine($"Couldn't open a handle to explorer.exe (pid {explorerProc.Id}) — falling back to a normal launch.");
            return LaunchNormallyAndWait(targetExe, targetArgs);
        }

        int exitCode;
        try
        {
            var launched = LaunchWithParent(targetExe, targetArgs, parentHandle);
            if (launched == null)
            {
                Console.Error.WriteLine("Reparented launch failed — falling back to a normal launch.");
                exitCode = LaunchNormallyAndWait(targetExe, targetArgs);
            }
            else
            {
                exitCode = launched.Value;
            }
        }
        finally
        {
            NativeMethods.CloseHandle(parentHandle);
        }
        return exitCode;
    }

    private static int LaunchNormallyAndWait(string exePath, string[] args)
    {
        try
        {
            var psi = new ProcessStartInfo(exePath) { UseShellExecute = false };
            foreach (var a in args) psi.ArgumentList.Add(a);
            using var proc = Process.Start(psi);
            if (proc == null) return 1;
            // Waiting here (instead of returning right after Process.Start)
            // matters even in this fallback path: a caller reading this
            // launcher's own exit as a stand-in for the target's (see
            // LaunchWithParent's doc comment) should see the same
            // behavior whether or not reparenting actually happened.
            proc.WaitForExit();
            return proc.ExitCode;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Fallback launch also failed: {ex.Message}");
            return 1;
        }
    }

    /// <summary>
    /// The actual reparenting launch: builds a one-attribute
    /// STARTUPINFOEX (PROC_THREAD_ATTRIBUTE_PARENT_PROCESS ->
    /// parentHandle) and calls CreateProcessW with
    /// EXTENDED_STARTUPINFO_PRESENT. Every step here can fail — this
    /// returns null (never throws) on any failure so the caller can
    /// fall back to a normal launch.
    ///
    /// Deliberately does NOT return the instant the target is created.
    /// This process stays alive, blocked on the target's process
    /// handle, until the target itself exits — then exits with that
    /// same code. This matters for how callers like electron/main.ts
    /// use this launcher: Node's `spawn()` still gets a well-formed
    /// "exit" event whose timing and code faithfully track the REAL
    /// target (kioskhook, the watchdog), not this launcher's own,
    /// otherwise much shorter, lifetime — a caller relying on that
    /// event (e.g. to know kioskhook has actually stopped) would
    /// otherwise see a false "stopped" signal moments after launch,
    /// when in fact only this intermediary exited and the real target
    /// is very much still running (correctly reparented, unaffected).
    /// Staying alive this way costs nothing toward the actual fix
    /// (Task Manager's grouped "End task" tree-walk goes by each
    /// process's own reported parent, not by whether this launcher is
    /// still around) since the target's reparenting already happened
    /// at CreateProcessW time, permanently, independent of this
    /// process's continued existence.
    /// </summary>
    private static int? LaunchWithParent(string exePath, string[] args, nint parentHandle)
    {
        var attributeListSize = IntPtr.Zero;
        // Expected to return false here — this first call's only job
        // is to fill attributeListSize with the buffer size actually
        // needed; it's not a real error.
        NativeMethods.InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref attributeListSize);
        if (attributeListSize == IntPtr.Zero) return null;

        var attributeList = Marshal.AllocHGlobal(attributeListSize);
        var parentHandleBuf = Marshal.AllocHGlobal(IntPtr.Size);
        try
        {
            if (!NativeMethods.InitializeProcThreadAttributeList(attributeList, 1, 0, ref attributeListSize)) return null;

            Marshal.WriteIntPtr(parentHandleBuf, parentHandle);

            if (!NativeMethods.UpdateProcThreadAttribute(
                    attributeList,
                    0,
                    NativeMethods.PROC_THREAD_ATTRIBUTE_PARENT_PROCESS,
                    parentHandleBuf,
                    (nuint)IntPtr.Size,
                    IntPtr.Zero,
                    IntPtr.Zero))
            {
                return null;
            }

            var startupInfo = new NativeMethods.STARTUPINFOEX();
            startupInfo.StartupInfo.cb = Marshal.SizeOf<NativeMethods.STARTUPINFOEX>();
            startupInfo.lpAttributeList = attributeList;

            // Explicitly pass this launcher's own stdin/stdout/stderr
            // down to the target — Node's spawn() already handed this
            // launcher inheritable pipe handles for those (the same
            // mechanism that lets a direct `spawn(exePath)` forward
            // stdio today); reusing them here means kioskhook's stdout
            // (its "WIN"/"ALTTAB" lines) and stdin (the "EXIT" command)
            // keep working unchanged even though it's now launched one
            // hop further away, through this process. bInheritHandles
            // below is what actually makes any inheritance possible —
            // handle inheritance is always resolved against the real
            // calling process's own handle table, regardless of which
            // parent PID gets reported via PROC_THREAD_ATTRIBUTE_PARENT_PROCESS,
            // so this and the reparenting above don't conflict.
            startupInfo.StartupInfo.dwFlags |= NativeMethods.STARTF_USESTDHANDLES;
            startupInfo.StartupInfo.hStdInput = NativeMethods.GetStdHandle(NativeMethods.STD_INPUT_HANDLE);
            startupInfo.StartupInfo.hStdOutput = NativeMethods.GetStdHandle(NativeMethods.STD_OUTPUT_HANDLE);
            startupInfo.StartupInfo.hStdError = NativeMethods.GetStdHandle(NativeMethods.STD_ERROR_HANDLE);

            // CreateProcessW's lpCommandLine must be a writable buffer
            // (the API is documented to modify it in place) — a
            // StringBuilder, not a plain string, is the standard P/Invoke
            // way to satisfy that.
            var commandLine = new StringBuilder(BuildCommandLine(exePath, args));

            var created = NativeMethods.CreateProcessW(
                null,
                commandLine,
                IntPtr.Zero,
                IntPtr.Zero,
                true,
                NativeMethods.EXTENDED_STARTUPINFO_PRESENT | NativeMethods.CREATE_NO_WINDOW,
                IntPtr.Zero,
                null,
                ref startupInfo,
                out var processInfo);

            if (!created) return null;

            NativeMethods.CloseHandle(processInfo.hThread);
            try
            {
                NativeMethods.WaitForSingleObject(processInfo.hProcess, NativeMethods.INFINITE);
                return NativeMethods.GetExitCodeProcess(processInfo.hProcess, out var exitCode) ? (int)exitCode : 0;
            }
            finally
            {
                NativeMethods.CloseHandle(processInfo.hProcess);
            }
        }
        finally
        {
            if (attributeList != IntPtr.Zero) NativeMethods.DeleteProcThreadAttributeList(attributeList);
            Marshal.FreeHGlobal(attributeList);
            Marshal.FreeHGlobal(parentHandleBuf);
        }
    }

    private static string BuildCommandLine(string exePath, string[] args)
    {
        var sb = new StringBuilder();
        sb.Append(Quote(exePath));
        foreach (var a in args)
        {
            sb.Append(' ');
            sb.Append(Quote(a));
        }
        return sb.ToString();
    }

    private static string Quote(string s) => s.Length == 0 || s.Contains(' ') ? $"\"{s}\"" : s;
}

internal static partial class NativeMethods
{
    public const uint PROCESS_CREATE_PROCESS = 0x0080;
    public const uint EXTENDED_STARTUPINFO_PRESENT = 0x00080000;
    public const uint CREATE_NO_WINDOW = 0x08000000;
    public const int STARTF_USESTDHANDLES = 0x00000100;
    public const int STD_INPUT_HANDLE = -10;
    public const int STD_OUTPUT_HANDLE = -11;
    public const int STD_ERROR_HANDLE = -12;
    public const uint INFINITE = 0xFFFFFFFF;
    public static readonly nint PROC_THREAD_ATTRIBUTE_PARENT_PROCESS = 0x00020000;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct STARTUPINFO
    {
        public int cb;
        public string? lpReserved;
        public string? lpDesktop;
        public string? lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public nint lpReserved2;
        public nint hStdInput;
        public nint hStdOutput;
        public nint hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct STARTUPINFOEX
    {
        public STARTUPINFO StartupInfo;
        public nint lpAttributeList;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION
    {
        public nint hProcess;
        public nint hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [LibraryImport("kernel32.dll", SetLastError = true)]
    public static partial nint OpenProcess(uint dwDesiredAccess, [MarshalAs(UnmanagedType.Bool)] bool bInheritHandle, uint dwProcessId);

    [LibraryImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool CloseHandle(nint hObject);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    public static partial nint GetStdHandle(int nStdHandle);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    public static partial uint WaitForSingleObject(nint hHandle, uint dwMilliseconds);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool GetExitCodeProcess(nint hProcess, out uint lpExitCode);

    // The attribute-list and CreateProcess functions below use classic
    // DllImport rather than LibraryImport — STARTUPINFOEX's embedded
    // strings and the `ref` struct parameter are simpler to get right
    // with the full, general-purpose marshaler than to fight the
    // source generator over (the same tradeoff windowembed's own
    // PROCESSENTRY32 handling already made, for the same reason).
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool InitializeProcThreadAttributeList(nint lpAttributeList, int dwAttributeCount, int dwFlags, ref nint lpSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool UpdateProcThreadAttribute(nint lpAttributeList, uint dwFlags, nint Attribute, nint lpValue, nuint cbSize, nint lpPreviousValue, nint lpReturnSize);

    [DllImport("kernel32.dll")]
    public static extern void DeleteProcThreadAttributeList(nint lpAttributeList);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CreateProcessW(
        string? lpApplicationName,
        StringBuilder lpCommandLine,
        nint lpProcessAttributes,
        nint lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        nint lpEnvironment,
        string? lpCurrentDirectory,
        ref STARTUPINFOEX lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation);
}
