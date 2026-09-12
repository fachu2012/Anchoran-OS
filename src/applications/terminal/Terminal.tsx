import { TerminalConsole } from "./TerminalConsole";

/**
 * The normal, windowed Terminal — a thin wrapper around the shared
 * console (see TerminalConsole.tsx). A window only ever starts in
 * Administrator mode when opened via "Run as Administrator" (right-
 * click the Terminal) after a real admin PIN check — there is no
 * in-terminal command that grants it mid-session, since that would be
 * an admin shell with no authentication at all. The crash screen's own
 * always-admin, no-chrome instance renders TerminalConsole directly
 * instead — see core/ErrorBoundary.tsx.
 */
export function TerminalApp({ startAdmin, windowId }: { startAdmin?: boolean; windowId?: string }) {
  return (
    <TerminalConsole
      admin={!!startAdmin}
      windowId={windowId}
      greeting={startAdmin ? 'Administrator Terminal. Type "help" to see the extra commands.' : undefined}
    />
  );
}
