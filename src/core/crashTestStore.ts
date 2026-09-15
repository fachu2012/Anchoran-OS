import { create } from "zustand";

/**
 * Backs the Admin Terminal's "anchoran testcrash 1" — the one test
 * crash type that has to happen inside React's own render phase to be
 * a genuine test of CrashReporter's componentDidCatch path (a throw
 * inside an event handler, like the Terminal's own command handler,
 * is NOT caught by a React error boundary — only a throw during
 * render, a lifecycle method, or a constructor is). Arming this store
 * and having a mounted component read it during render is the
 * straightforward way to produce a real render-phase throw on demand.
 */
export const useCrashTestStore = create<{ armed: boolean; arm: () => void }>((set) => ({
  armed: false,
  arm: () => set({ armed: true }),
}));
