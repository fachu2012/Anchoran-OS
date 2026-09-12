import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import { usePreferencesStore } from "@/theme/preferencesStore";

/**
 * Multiple local user profiles. Scope, honestly stated: each profile
 * has its own name, avatar, PIN and appearance (accent, wallpaper,
 * theme) — everything preferencesStore already tracks. App data (Files
 * — which is real Windows files anyway — Notes, Todo, Kanban, and
 * every other app's own persisted store) stays shared across profiles;
 * fully isolating that too would mean namespacing dozens of separate
 * persisted stores by profile id, which is out of scope here. This is
 * an "appearance and identity" multi-profile model, not full OS-level
 * per-user data isolation.
 */
export interface Profile {
  id: string;
  name: string;
  avatarDataUrl: string | null;
  lockPin: string | null;
  accentColor: string;
  wallpaperId: string;
  customWallpaperDataUrl: string | null;
  themeMode: "light" | "dark";
}

const STORAGE_KEY = "profiles";
const ACTIVE_KEY = "activeProfileId";

function snapshotFromPreferences(id: string): Profile {
  const p = usePreferencesStore.getState();
  return {
    id,
    name: p.username,
    avatarDataUrl: p.avatarDataUrl,
    lockPin: p.lockPin,
    accentColor: p.accentColor,
    wallpaperId: p.wallpaperId,
    customWallpaperDataUrl: p.customWallpaperDataUrl,
    themeMode: p.themeMode,
  };
}

function applyToPreferences(profile: Profile) {
  const prefs = usePreferencesStore.getState();
  prefs.setUsername(profile.name);
  prefs.setAvatar(profile.avatarDataUrl);
  prefs.setLockPin(profile.lockPin);
  prefs.setAccentColor(profile.accentColor);
  if (profile.customWallpaperDataUrl) prefs.setCustomWallpaper(profile.customWallpaperDataUrl);
  prefs.setWallpaper(profile.wallpaperId);
  prefs.setThemeMode(profile.themeMode);
}

interface ProfilesState {
  profiles: Profile[];
  activeProfileId: string;
  hydrated: boolean;
  createProfile: (name: string) => string;
  deleteProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  /** Saves the live preferencesStore state into the currently-active profile, then switches to another and loads its saved state in. */
  switchProfile: (id: string) => void;
}

function persist(profiles: Profile[], activeProfileId: string) {
  persistSet("config", STORAGE_KEY, profiles);
  persistSet("config", ACTIVE_KEY, activeProfileId);
}

export const useProfilesStore = create<ProfilesState>((set, get) => ({
  profiles: [],
  activeProfileId: "",
  hydrated: false,

  createProfile: (name) => {
    const id = `profile-${Date.now()}`;
    const blank: Profile = {
      id,
      name,
      avatarDataUrl: null,
      lockPin: null,
      accentColor: "#6E9BF7",
      wallpaperId: "default",
      customWallpaperDataUrl: null,
      themeMode: "dark",
    };
    const profiles = [...get().profiles, blank];
    set({ profiles });
    persist(profiles, get().activeProfileId);
    return id;
  },

  deleteProfile: (id) => {
    const { profiles, activeProfileId } = get();
    if (profiles.length <= 1) return; // always keep at least one profile
    const next = profiles.filter((p) => p.id !== id);
    if (activeProfileId === id) {
      // Switching away from the profile being deleted first.
      get().switchProfile(next[0].id);
    }
    set({ profiles: next });
    persist(next, get().activeProfileId);
  },

  renameProfile: (id, name) => {
    const profiles = get().profiles.map((p) => (p.id === id ? { ...p, name } : p));
    set({ profiles });
    persist(profiles, get().activeProfileId);
    if (id === get().activeProfileId) usePreferencesStore.getState().setUsername(name);
  },

  switchProfile: (id) => {
    const { profiles, activeProfileId } = get();
    if (id === activeProfileId) return;
    const target = profiles.find((p) => p.id === id);
    if (!target) return;
    // Save the outgoing profile's live state before loading the new one in.
    const updated = profiles.map((p) => (p.id === activeProfileId ? snapshotFromPreferences(activeProfileId) : p));
    set({ profiles: updated, activeProfileId: id });
    persist(updated, id);
    applyToPreferences(target);
  },
}));

Promise.all([
  persistGet<Profile[]>("config", STORAGE_KEY, []),
  persistGet<string>("config", ACTIVE_KEY, ""),
]).then(([profiles, activeProfileId]) => {
  if (profiles.length === 0) {
    // First run after this feature shipped, or a fresh install —
    // migrate whatever's already in preferencesStore into "Profile 1"
    // rather than starting empty.
    const id = "profile-default";
    const migrated = snapshotFromPreferences(id);
    profiles = [migrated];
    activeProfileId = id;
    persistSet("config", STORAGE_KEY, profiles);
    persistSet("config", ACTIVE_KEY, activeProfileId);
  }
  if (!profiles.some((p) => p.id === activeProfileId)) activeProfileId = profiles[0].id;
  useProfilesStore.setState({ profiles, activeProfileId, hydrated: true });
});
