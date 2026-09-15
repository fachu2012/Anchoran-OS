import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { useAdminAuditStore } from "@/core/adminAuditStore";

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
  /** Can administer this Anchoran PC — required to unlock an Administrator Terminal, and (if not the owner) to have their own admin status changed by the owner. */
  isAdmin: boolean;
  /** The very first profile ever created on this PC. Always an admin; this can never be revoked, and only the owner may grant/revoke admin status on *other* profiles. Exactly one profile has this set. */
  isOwner: boolean;
  /** The single, permanent "Guest" profile started from the lock screen's "Continue as Guest" — always present, can never be deleted or renamed, and can't set a PIN or change its own appearance (accent, wallpaper, theme, avatar). Its fields are reset back to fixed defaults every time it's entered, incognito-style, so nothing from a previous guest session ever lingers. App data itself (Notes, Files, …) is still shared across every profile, guest included — see the file-level note above on the scope of per-profile isolation. */
  isGuest?: boolean;
}

/** The one, permanent Guest profile always shares this id — never a fresh timestamped one — so it can be found, reset, and protected from deletion reliably. */
export const GUEST_PROFILE_ID = "guest-permanent";

function defaultGuestProfile(): Profile {
  return {
    id: GUEST_PROFILE_ID,
    name: "Guest",
    avatarDataUrl: null,
    lockPin: null,
    accentColor: "#6E9BF7",
    wallpaperId: "default",
    customWallpaperDataUrl: null,
    themeMode: "dark",
    isAdmin: false,
    isOwner: false,
    isGuest: true,
  };
}

const STORAGE_KEY = "profiles";
const ACTIVE_KEY = "activeProfileId";

function snapshotFromPreferences(id: string, isAdmin = false, isOwner = false): Profile {
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
    isAdmin,
    isOwner,
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
  createProfile: (name: string, isAdmin?: boolean) => string;
  /** Resets the permanent Guest profile back to its fixed defaults and switches into it — see Profile.isGuest above. */
  createGuestProfile: () => void;
  deleteProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  /** Saves the live preferencesStore state into the currently-active profile, then switches to another and loads its saved state in. */
  switchProfile: (id: string) => void;
  /** Grants or revokes admin status on another profile. Only the owner (the permanent first-created profile) may call this, and never on the owner's own profile — the caller is responsible for that check; this is enforced again here as a safety net. */
  setProfileAdmin: (id: string, isAdmin: boolean) => void;
  /** Checks a PIN against every admin profile on this PC; returns the matching profile, or null if none match. Used by the "Run as Administrator" elevation prompt. */
  findAdminByPin: (pin: string) => Profile | null;
}

function persist(profiles: Profile[], activeProfileId: string) {
  persistSet("config", STORAGE_KEY, profiles);
  persistSet("config", ACTIVE_KEY, activeProfileId);
}

export const useProfilesStore = create<ProfilesState>((set, get) => ({
  profiles: [],
  activeProfileId: "",
  hydrated: false,

  createProfile: (name, isAdmin = false) => {
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
      isAdmin,
      isOwner: false,
    };
    const profiles = [...get().profiles, blank];
    set({ profiles });
    persist(profiles, get().activeProfileId);
    return id;
  },

  createGuestProfile: () => {
    const { profiles, activeProfileId } = get();
    const fresh = defaultGuestProfile();
    const next = profiles.some((p) => p.id === GUEST_PROFILE_ID)
      ? profiles.map((p) => (p.id === GUEST_PROFILE_ID ? fresh : p))
      : [...profiles, fresh];
    set({ profiles: next });
    persist(next, activeProfileId);
    if (activeProfileId === GUEST_PROFILE_ID) {
      // Already signed in as Guest (e.g. re-locked and hit "Continue as
      // Guest" again without switching away) — switchProfile() below would
      // no-op since the id isn't changing, so apply the reset directly.
      applyToPreferences(fresh);
    } else {
      get().switchProfile(GUEST_PROFILE_ID);
    }
  },

  deleteProfile: (id) => {
    const { profiles, activeProfileId } = get();
    if (profiles.length <= 1) return; // always keep at least one profile
    const target = profiles.find((p) => p.id === id);
    if (target?.isOwner || target?.isGuest) return; // the owner and the permanent Guest profile can never be deleted
    const next = profiles.filter((p) => p.id !== id);
    if (activeProfileId === id) {
      // Switching away from the profile being deleted first.
      get().switchProfile(next[0].id);
    }
    set({ profiles: next });
    persist(next, get().activeProfileId);
  },

  renameProfile: (id, name) => {
    if (get().profiles.find((p) => p.id === id)?.isGuest) return; // Guest's name is fixed
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
    // Save the outgoing profile's live state before loading the new one in, preserving its admin/owner flags (those aren't part of preferencesStore).
    const outgoing = profiles.find((p) => p.id === activeProfileId);
    const updated = profiles.map((p) =>
      p.id === activeProfileId ? snapshotFromPreferences(activeProfileId, outgoing?.isAdmin, outgoing?.isOwner) : p
    );
    set({ profiles: updated, activeProfileId: id });
    persist(updated, id);
    applyToPreferences(target);
  },

  setProfileAdmin: (id, isAdmin) => {
    const { profiles, activeProfileId } = get();
    const caller = profiles.find((p) => p.id === activeProfileId);
    const target = profiles.find((p) => p.id === id);
    if (!caller?.isOwner || !target || target.isOwner) return; // only the owner grants/revokes, and never on the owner
    const next = profiles.map((p) => (p.id === id ? { ...p, isAdmin } : p));
    set({ profiles: next });
    persist(next, activeProfileId);
    useAdminAuditStore.getState().record(`${isAdmin ? "Granted" : "Revoked"} admin ${isAdmin ? "to" : "from"} "${target.name}"`);
  },

  findAdminByPin: (pin) => {
    if (!pin) return null;
    const match = get().profiles.find((p) => p.isAdmin && p.lockPin && p.lockPin === pin) ?? null;
    if (match) useAdminAuditStore.getState().record(`Elevated as "${match.name}"`);
    return match;
  },
}));

/**
 * Keeps `profiles` in sync with live edits to the ACTIVE profile.
 * Before this existed, `profiles`' own copy of the active profile
 * (its PIN, accent, wallpaper, name, avatar, theme) only ever got
 * refreshed at the moment switchProfile() ran (it snapshots the
 * OUTGOING profile on the way out) — so any Settings change made
 * while staying on that same profile (e.g. setting a PIN in
 * Settings → Users, then immediately creating another profile without
 * ever switching away) was invisible to `profiles` indefinitely. A
 * real, live-tested bug: an owner set their own PIN, created a second
 * profile, and "Run as Administrator" then reported no admin account
 * on this PC had a PIN set at all — findAdminByPin() was still reading
 * `profiles`' stale, pre-PIN copy of the owner, since nothing had ever
 * switched away from it since.
 */
function installActiveProfileSync() {
  usePreferencesStore.subscribe(() => {
    const { profiles, activeProfileId, hydrated } = useProfilesStore.getState();
    if (!hydrated || !activeProfileId) return;
    const idx = profiles.findIndex((p) => p.id === activeProfileId);
    if (idx === -1) return;
    const current = profiles[idx];
    // Guest is reset to fixed defaults on every entry by its own store
    // and deliberately never persists anything back — leave it alone.
    if (current.isGuest) return;
    const fresh = snapshotFromPreferences(activeProfileId, current.isAdmin, current.isOwner);
    if (
      fresh.name === current.name &&
      fresh.avatarDataUrl === current.avatarDataUrl &&
      fresh.lockPin === current.lockPin &&
      fresh.accentColor === current.accentColor &&
      fresh.wallpaperId === current.wallpaperId &&
      fresh.customWallpaperDataUrl === current.customWallpaperDataUrl &&
      fresh.themeMode === current.themeMode
    ) {
      return; // Nothing actually changed (e.g. this fired from our own applyToPreferences during a switch) — skip the no-op persist.
    }
    const next = profiles.map((p, i) => (i === idx ? fresh : p));
    useProfilesStore.setState({ profiles: next });
    persist(next, activeProfileId);
  });
}
installActiveProfileSync();

Promise.all([
  persistGet<Profile[]>("config", STORAGE_KEY, []),
  persistGet<string>("config", ACTIVE_KEY, ""),
]).then(([profiles, activeProfileId]) => {
  let dirty = false;
  if (profiles.length === 0) {
    // First run after this feature shipped, or a fresh install —
    // migrate whatever's already in preferencesStore into "Profile 1"
    // rather than starting empty. The very first profile is permanently
    // the owner and an admin.
    const id = "profile-default";
    const migrated = snapshotFromPreferences(id, true, true);
    profiles = [migrated];
    activeProfileId = id;
    dirty = true;
  } else if (!profiles.some((p) => p.isOwner)) {
    // Profiles saved before the admin/owner concept existed — grant
    // ownership to the oldest one (profiles are appended in creation
    // order) so exactly one profile is always the permanent owner.
    profiles = profiles.map((p, i) => ({ ...p, isAdmin: p.isAdmin ?? i === 0, isOwner: i === 0 }));
    dirty = true;
  }
  // Drop any leftover throwaway guest from before Guest became a single
  // permanent profile (an old-style timestamped guest id could survive a
  // crash mid-session), then make sure the one permanent Guest exists.
  const cleanedProfiles = profiles.filter((p) => !p.isGuest || p.id === GUEST_PROFILE_ID);
  if (cleanedProfiles.length !== profiles.length) {
    profiles = cleanedProfiles;
    if (activeProfileId && !profiles.some((p) => p.id === activeProfileId)) activeProfileId = "";
    dirty = true;
  }
  if (!profiles.some((p) => p.id === GUEST_PROFILE_ID)) {
    profiles = [...profiles, defaultGuestProfile()];
    dirty = true;
  }
  if (!profiles.some((p) => p.id === activeProfileId)) activeProfileId = profiles.find((p) => !p.isGuest)?.id ?? profiles[0].id;
  if (dirty) {
    persistSet("config", STORAGE_KEY, profiles);
    persistSet("config", ACTIVE_KEY, activeProfileId);
  }
  useProfilesStore.setState({ profiles, activeProfileId, hydrated: true });
});
