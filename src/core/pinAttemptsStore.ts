import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";

export interface PinAttempt {
  id: string;
  timestamp: number;
}

const KEY = "failedPinAttempts";
const MAX_ENTRIES = 50;

interface PinAttemptsState {
  attempts: PinAttempt[];
  record: () => void;
  clear: () => void;
}

/** A record of failed PIN attempts on the lock screen — visible only to the owner (see Settings' Users section), never shown to anyone else. */
export const usePinAttemptsStore = create<PinAttemptsState>((set, get) => ({
  attempts: [],
  record: () => {
    const attempts = [{ id: `attempt-${Date.now()}`, timestamp: Date.now() }, ...get().attempts].slice(0, MAX_ENTRIES);
    set({ attempts });
    persistSet("config", KEY, attempts);
  },
  clear: () => {
    set({ attempts: [] });
    persistSet("config", KEY, []);
  },
}));

persistGet<PinAttempt[]>("config", KEY, []).then((attempts) => {
  usePinAttemptsStore.setState({ attempts });
});
