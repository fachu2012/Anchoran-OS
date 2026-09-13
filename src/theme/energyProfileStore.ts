import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import { usePreferencesStore } from "@/theme/preferencesStore";

export type PowerProfile = "batterySaver" | "balanced" | "performance";

export const POWER_PROFILE_LABELS: Record<PowerProfile, string> = {
  batterySaver: "Battery Saver",
  balanced: "Balanced",
  performance: "Performance",
};

/**
 * Honest about its scope: Anchoran is a desktop shell running inside
 * Electron, not a real driver stack, so this profile can't actually
 * throttle the CPU/GPU or touch the host's real Windows power plan.
 * What it *can* do for real is dial back the things that cost real
 * battery inside Anchoran's own renderer — animations and screen
 * brightness — the same trade the built-in "reduce animations"
 * toggle already made, now as three clear presets instead of one.
 */
const PROFILE_SETTINGS: Record<PowerProfile, { animationsEnabled: boolean; brightness: number }> = {
  batterySaver: { animationsEnabled: false, brightness: 0.7 },
  balanced: { animationsEnabled: true, brightness: 1 },
  performance: { animationsEnabled: true, brightness: 1 },
};

const KEY = "powerProfile";

interface EnergyProfileState {
  profile: PowerProfile;
  setProfile: (profile: PowerProfile) => void;
}

export const useEnergyProfileStore = create<EnergyProfileState>((set) => ({
  profile: "balanced",
  setProfile: (profile) => {
    set({ profile });
    persistSet("config", KEY, profile);
    const settings = PROFILE_SETTINGS[profile];
    usePreferencesStore.getState().setAnimationsEnabled(settings.animationsEnabled);
    usePreferencesStore.getState().setBrightness(settings.brightness);
  },
}));

persistGet<PowerProfile>("config", KEY, "balanced").then((profile) => {
  useEnergyProfileStore.setState({ profile });
});
