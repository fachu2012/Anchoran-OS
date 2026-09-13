import buildChannelData from "./buildChannel.json";

/**
 * Whether THIS specific installed binary was built from an Insider
 * Preview Update (I.P.U.) tag or a plain, stable one — not to be
 * confused with the "Insider Preview updates" toggle (which controls
 * whether this device *offers* to install I.P.U. builds going
 * forward). version.json/package.json deliberately carry the same
 * plain version number for both an I.P.U. build and its later stable
 * release of the same version, so electron-updater compares them as
 * equal — which means that number alone can never answer "was this
 * particular build insider or stable". This file is committed as
 * "stable" and overwritten to "insider" by the release workflow's
 * "Determine release channel" step right before an I.P.U. build, so
 * the answer baked into the bundle is always accurate for whichever
 * binary is actually running. See Anchover.tsx, the one place this is
 * shown.
 */
export const BUILD_CHANNEL: "stable" | "insider" = buildChannelData.channel === "insider" ? "insider" : "stable";
