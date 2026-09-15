/**
 * Anchoran's crash watchdog — a plain Node.js script (spawned with
 * ELECTRON_RUN_AS_NODE=1 over the very same packaged Electron binary,
 * so no separate runtime needs to ship) that exists entirely OUTSIDE
 * Anchoran's own process, specifically so it can still act when
 * Anchoran itself dies outright — an uncaught main-process exception,
 * a renderer that never recovers, the whole process getting killed —
 * none of which a handler living *inside* that same process could
 * ever reliably react to. This is what replaced the old in-process
 * React ErrorBoundary: that could only ever catch one narrow class of
 * failure (a React render throwing); this catches all of them, the
 * same way, in one place.
 *
 * One-shot by design: it does exactly one job — watch, then react
 * once — and exits. A relaunched Anchoran (via "Restart Anchoran" on
 * the crash screen, or a normal fresh launch) spawns its own new
 * watchdog for its own new session; nothing here needs to keep
 * running past the moment it's already done its job.
 *
 * Protocol (a Windows named pipe, `\\.\pipe\anchoran-watchdog-<pid>`,
 * `<pid>` being Anchoran's own process id — unique per session, so an
 * old crashed session's watchdog can never be confused with a fresh
 * one's):
 *   Anchoran -> watchdog: "PING\n" every ANCHORAN_HEARTBEAT_MS, and
 *     "CRASH:<json>\n" once, immediately before Anchoran's own process
 *     ends on purpose because of a fatal error (see main.ts's
 *     uncaughtException handler and its "renderer-fatal-error" IPC
 *     handler — both funnel into the exact same send).
 * The watchdog reacts to either "CRASH" or PINGs simply stopping
 * (silence past WATCHDOG_TIMEOUT_MS, or the pid confirmed gone) by
 * spawning a fresh Anchoran instance with `--anchoran-crash-screen
 * <message>`, which main.ts recognizes and shows only the crash
 * screen instead of Anchoran's normal desktop — see main.ts's
 * `isCrashScreenMode`.
 */
import net from "node:net";
import { spawn } from "node:child_process";

const HEARTBEAT_TIMEOUT_MS = 15000;
const CHECK_INTERVAL_MS = 3000;

function main() {
  const [, , anchoranPidRaw, execPathArg, appEntryArg] = process.argv;
  const anchoranPid = Number(anchoranPidRaw);
  if (!Number.isFinite(anchoranPid) || !execPathArg) {
    console.error("watchdog: missing required arguments (anchoranPid, execPath[, appEntry]).");
    process.exit(1);
  }
  // appEntryArg is only present in dev (unpackaged) mode, where
  // relaunching means `electron <projectDir> <flags>` rather than
  // just `<packaged-exe> <flags>` — see main.ts's spawn call for
  // exactly how these are passed.
  const appEntry = appEntryArg && appEntryArg.length > 0 ? appEntryArg : null;

  let lastPingAt = Date.now();
  let done = false;

  function relaunchAsCrashScreen(message: string) {
    if (done) return;
    done = true;
    const args = appEntry ? [appEntry, "--anchoran-crash-screen", message] : ["--anchoran-crash-screen", message];
    try {
      spawn(execPathArg, args, { detached: true, stdio: "ignore" }).unref();
    } catch (err) {
      console.error(`watchdog: failed to relaunch the crash screen: ${err instanceof Error ? err.message : String(err)}`);
    }
    server.close();
    clearInterval(pollTimer);
    process.exit(0);
  }

  function isAnchoranStillRunning(): boolean {
    try {
      // Signal 0 sends nothing — it only checks whether the process
      // exists and is reachable, the standard Node idiom for this.
      process.kill(anchoranPid, 0);
      return true;
    } catch {
      return false;
    }
  }

  const pollTimer = setInterval(() => {
    if (done) return;
    const silentFor = Date.now() - lastPingAt;
    if (!isAnchoranStillRunning()) {
      relaunchAsCrashScreen("Anchoran's process ended unexpectedly.");
    } else if (silentFor > HEARTBEAT_TIMEOUT_MS) {
      relaunchAsCrashScreen("Anchoran stopped responding.");
    }
  }, CHECK_INTERVAL_MS);

  const pipePath = `\\\\.\\pipe\\anchoran-watchdog-${anchoranPid}`;
  const server = net.createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line === "PING") {
          lastPingAt = Date.now();
        } else if (line.startsWith("CRASH:")) {
          let message = "Anchoran crashed.";
          try {
            const parsed = JSON.parse(line.slice("CRASH:".length)) as { message?: string };
            if (parsed.message) message = parsed.message;
          } catch {
            // Malformed payload — still a real crash signal, just show a generic message instead of failing to react at all.
          }
          relaunchAsCrashScreen(message);
        }
      }
    });
  });
  server.on("error", (err) => {
    console.error(`watchdog: pipe server error: ${err.message}`);
  });
  server.listen(pipePath);
}

main();
