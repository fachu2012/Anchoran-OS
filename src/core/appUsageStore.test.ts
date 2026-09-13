import { beforeEach, describe, expect, it } from "vitest";
import { useAppUsageStore } from "./appUsageStore";

function resetStore() {
  useAppUsageStore.setState({ usage: {} });
}

describe("appUsageStore", () => {
  beforeEach(resetStore);

  it("starts with no usage recorded", () => {
    expect(useAppUsageStore.getState().topApps(5)).toEqual([]);
  });

  it("ranks apps by open count, most-used first", () => {
    const { record } = useAppUsageStore.getState();
    record("notes");
    record("terminal");
    record("terminal");
    record("terminal");
    record("files");
    record("files");

    expect(useAppUsageStore.getState().topApps(3)).toEqual(["terminal", "files", "notes"]);
  });

  it("breaks a count tie by whichever was opened more recently", () => {
    const { record } = useAppUsageStore.getState();
    record("notes");
    record("terminal");
    // Both now have count 1 — terminal was recorded after notes, so it should rank first.
    expect(useAppUsageStore.getState().topApps(2)).toEqual(["terminal", "notes"]);
  });

  it("respects the requested limit", () => {
    const { record } = useAppUsageStore.getState();
    record("notes");
    record("terminal");
    record("files");
    expect(useAppUsageStore.getState().topApps(2)).toHaveLength(2);
  });
});
