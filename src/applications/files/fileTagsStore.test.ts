import { beforeEach, describe, expect, it } from "vitest";
import { useFileTagsStore } from "./fileTagsStore";

function resetStore() {
  useFileTagsStore.setState({ tags: {} });
}

describe("fileTagsStore", () => {
  beforeEach(resetStore);

  it("assigns a color tag to a path", () => {
    useFileTagsStore.getState().setTag("a.txt", "blue");
    expect(useFileTagsStore.getState().tags["a.txt"]).toBe("blue");
  });

  it("passing null clears an existing tag entirely, rather than storing null", () => {
    const { setTag } = useFileTagsStore.getState();
    setTag("a.txt", "red");
    setTag("a.txt", null);
    expect(useFileTagsStore.getState().tags).not.toHaveProperty("a.txt");
  });

  it("reassigning a tag overwrites the previous color", () => {
    const { setTag } = useFileTagsStore.getState();
    setTag("a.txt", "red");
    setTag("a.txt", "green");
    expect(useFileTagsStore.getState().tags["a.txt"]).toBe("green");
  });
});
