import { describe, expect, it } from "vitest";
import { APP_REMOVAL_VERSION, crossesAppRemoval, installedLegacyApps, needsLocalAppsRemovalNotice } from "./upgradeAppRemoval";
import { LEGACY_APP_IDS } from "./legacyAppIds";

describe("crossesAppRemoval", () => {
  it("is true for a device on a version older than the removal boundary", () => {
    expect(crossesAppRemoval("3.3.6")).toBe(true);
    expect(crossesAppRemoval("2.9.2")).toBe(true);
    expect(crossesAppRemoval("3.0.0")).toBe(true);
  });

  it("is false for a device already on or past the removal boundary", () => {
    expect(crossesAppRemoval(APP_REMOVAL_VERSION)).toBe(false);
    expect(crossesAppRemoval("3.4.1")).toBe(false);
    expect(crossesAppRemoval("4.0.0")).toBe(false);
  });

  it("ignores an I.P.U. prerelease suffix the same way compareVersions does", () => {
    expect(crossesAppRemoval("3.3.6-beta")).toBe(true);
    expect(crossesAppRemoval("3.4.0-beta")).toBe(false);
  });

  it("is false when the update target itself doesn't reach the boundary (e.g. a hotfix for an even older line)", () => {
    expect(crossesAppRemoval("3.1.0", "3.1.5")).toBe(false);
  });

  it("is true as soon as the target reaches or passes the boundary, from an older device", () => {
    expect(crossesAppRemoval("3.3.6", "3.4.0")).toBe(true);
    expect(crossesAppRemoval("3.3.6", "3.5.0")).toBe(true);
  });
});

describe("installedLegacyApps", () => {
  it("returns nothing when none of the installed ids are legacy apps", () => {
    expect(installedLegacyApps(["files", "terminal", "settings"])).toEqual([]);
  });

  it("returns only the legacy apps actually present, in LEGACY_APP_IDS order", () => {
    const result = installedLegacyApps(["files", "chess", "settings", "snake"]);
    expect(result.map((a) => a.id)).toEqual(["snake", "chess"]);
  });

  it("finds every legacy app id when the whole legacy set is installed", () => {
    const result = installedLegacyApps(LEGACY_APP_IDS.map((a) => a.id));
    expect(result).toHaveLength(LEGACY_APP_IDS.length);
  });

  it("is not fooled by a plugin id that happens to share a name with a core app", () => {
    // "chat" the old bundled app id and "chat" the new plugin id are
    // spelled the same on purpose (a straight 1:1 rename) — installed
    // apps store real AppIds, not plugin ids, so this must still match.
    expect(installedLegacyApps(["chat"]).map((a) => a.id)).toEqual(["chat"]);
  });
});

describe("needsLocalAppsRemovalNotice", () => {
  it("is false for an up-to-date device even with old app ids somehow still recorded", () => {
    expect(needsLocalAppsRemovalNotice(APP_REMOVAL_VERSION, ["snake"])).toBe(false);
  });

  it("is false for an old device with none of the removed apps installed", () => {
    expect(needsLocalAppsRemovalNotice("3.3.6", ["files", "terminal", "settings"])).toBe(false);
  });

  it("is true only when both the version boundary is crossed and a legacy app is installed", () => {
    expect(needsLocalAppsRemovalNotice("3.3.6", ["files", "chat"])).toBe(true);
  });

  it("matches the example the user gave: Chat installed on an old device", () => {
    expect(needsLocalAppsRemovalNotice("3.3.6", ["files", "terminal", "settings", "chat"])).toBe(true);
  });
});
