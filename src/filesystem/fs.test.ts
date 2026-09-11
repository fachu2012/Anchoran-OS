import { beforeEach, describe, expect, it } from "vitest";
import { useFsStore, ROOT_ID, TRASH_ID } from "./fs";

function resetStore() {
  const now = Date.now();
  useFsStore.setState({
    nodes: {
      [ROOT_ID]: { id: ROOT_ID, type: "folder", name: "Home", parentId: null, createdAt: now, updatedAt: now },
    },
    hydrated: true,
  });
}

describe("virtual filesystem store", () => {
  beforeEach(resetStore);

  it("creates a folder under the given parent", () => {
    const id = useFsStore.getState().createFolder(ROOT_ID, "Projects");
    const children = useFsStore.getState().childrenOf(ROOT_ID);
    expect(children).toHaveLength(1);
    expect(children[0].id).toBe(id);
    expect(children[0].type).toBe("folder");
  });

  it("creates a file with content", () => {
    const id = useFsStore.getState().createFile(ROOT_ID, "todo.txt", "hello");
    expect(useFsStore.getState().getNode(id)?.content).toBe("hello");
  });

  it("renaming updates the node's name", () => {
    const id = useFsStore.getState().createFile(ROOT_ID, "old.txt");
    useFsStore.getState().rename(id, "new.txt");
    expect(useFsStore.getState().getNode(id)?.name).toBe("new.txt");
  });

  it("permanentlyDelete cascades to descendants", () => {
    const folderId = useFsStore.getState().createFolder(ROOT_ID, "Parent");
    const fileId = useFsStore.getState().createFile(folderId, "child.txt");
    useFsStore.getState().permanentlyDelete(folderId);
    expect(useFsStore.getState().getNode(folderId)).toBeUndefined();
    expect(useFsStore.getState().getNode(fileId)).toBeUndefined();
  });

  it("remove moves a node to Trash instead of deleting it, and restore undoes it", () => {
    const fileId = useFsStore.getState().createFile(ROOT_ID, "doc.txt");
    useFsStore.getState().remove(fileId);
    expect(useFsStore.getState().getNode(fileId)?.parentId).toBe(TRASH_ID);

    useFsStore.getState().restore(fileId);
    expect(useFsStore.getState().getNode(fileId)?.parentId).toBe(ROOT_ID);
  });

  it("search finds nodes by name, excluding Trash", () => {
    useFsStore.getState().createFile(ROOT_ID, "report-final.txt");
    const trashedId = useFsStore.getState().createFile(ROOT_ID, "report-old.txt");
    useFsStore.getState().remove(trashedId);

    const results = useFsStore.getState().search("report");
    expect(results.map((n) => n.name)).toEqual(["report-final.txt"]);
  });

  it("getPath returns the full ancestor chain in order", () => {
    const folderId = useFsStore.getState().createFolder(ROOT_ID, "Docs");
    const fileId = useFsStore.getState().createFile(folderId, "note.txt");
    const path = useFsStore.getState().getPath(fileId).map((n) => n.name);
    expect(path).toEqual(["Home", "Docs", "note.txt"]);
  });

  it("moving a node updates its parent", () => {
    const folderA = useFsStore.getState().createFolder(ROOT_ID, "A");
    const folderB = useFsStore.getState().createFolder(ROOT_ID, "B");
    const fileId = useFsStore.getState().createFile(folderA, "note.txt");
    useFsStore.getState().move(fileId, folderB);
    expect(useFsStore.getState().getNode(fileId)?.parentId).toBe(folderB);
  });
});
