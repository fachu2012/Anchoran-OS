/**
 * Anchoran's classic blue — the fixed brand color for the lone
 * Anchoran icon wherever it appears on its own (the boot sequence,
 * lock/shutdown screens, update screens, and similar full-screen
 * moments), independent of whatever accent color the current profile
 * has chosen. Before this existed, that icon just used the active
 * profile's `accentColor`, so a red or green accent would show up in
 * places meant to read as Anchoran's own brand identity rather than a
 * per-user color choice — now it always renders in this blue instead.
 *
 * This is deliberately scoped to the *solitary* icon only. Anything
 * that's genuinely part of the user's own customized desktop — most
 * notably the Dock/Taskbar's icon — keeps following the profile's
 * `accentColor` as before; that's still meant to reflect the user's
 * own choice, not Anchoran's brand mark.
 *
 * Not coincidentally, this is the same hex as `accentColor`'s own
 * default (see preferencesStore.ts / profilesStore.ts) — it's the
 * color Anchoran ships with before anyone changes it, promoted here to
 * a fixed brand constant used regardless of what a profile later picks.
 */
export const ANCHORAN_CLASSIC_BLUE = "#6E9BF7";
