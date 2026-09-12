import { useState } from "react";
import { TerminalConsole } from "./TerminalConsole";

/**
 * The normal, windowed Terminal — a thin wrapper around the shared
 * console (see TerminalConsole.tsx): starts in regular-user mode, and
 * the secret "sudo" command flips it into the Administrator Terminal
 * for the rest of this window's life. The crash screen's own always-
 * admin, no-chrome instance renders TerminalConsole directly instead
 * — see core/ErrorBoundary.tsx.
 */
export function TerminalApp() {
  const [admin, setAdmin] = useState(false);
  return <TerminalConsole admin={admin} onUnlockAdmin={() => setAdmin(true)} />;
}
