import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";

/**
 * Anchoran's own virtual filesystem. It is entirely separate from the
 * real Windows filesystem: nothing here reads or writes host files by
 * default (Files' "Import from Windows" action is the one deliberate,
 * explicit exception — see Files.tsx). It persists to Anchoran's own
 * on-disk data store (electron-store under the app's data/ folder),
 * mirroring the "data / config / apps / cache / logs" separation
 * described in the architecture.
 */

export type FsNodeType = "folder" | "file";

export interface FsNode {
  id: string;
  type: FsNodeType;
  name: string;
  parentId: string | null;
  content?: string; // files only
  createdAt: number;
  updatedAt: number;
  /** Set while the node lives in Trash — the parent to restore it into. */
  trashedFrom?: string;
}

const STORAGE_KEY = "filesystem";
export const ROOT_ID = "root";
export const TRASH_ID = "trash";
export const DOWNLOADS_ID = "downloads";
export const DESKTOP_ID = "desktop";

function defaultNodes(): Record<string, FsNode> {
  const now = Date.now();
  const mk = (id: string, type: FsNodeType, name: string, parentId: string | null): FsNode => ({
    id,
    type,
    name,
    parentId,
    content: type === "file" ? "" : undefined,
    createdAt: now,
    updatedAt: now,
  });

  return {
    [ROOT_ID]: mk(ROOT_ID, "folder", "Home", null),
    documents: mk("documents", "folder", "Documents", ROOT_ID),
    [DOWNLOADS_ID]: mk(DOWNLOADS_ID, "folder", "Downloads", ROOT_ID),
    notes: mk("notes", "folder", "Notes", ROOT_ID),
    [DESKTOP_ID]: mk(DESKTOP_ID, "folder", "Desktop", ROOT_ID),
    [TRASH_ID]: mk(TRASH_ID, "folder", "Trash", null),
  };
}

function persist(nodes: Record<string, FsNode>) {
  persistSet("data", STORAGE_KEY, nodes);
}

let idCounter = 0;
function createId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function descendantsOf(nodes: Record<string, FsNode>, id: string): Set<string> {
  const set = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of Object.values(nodes)) {
      if (n.parentId && set.has(n.parentId) && !set.has(n.id)) {
        set.add(n.id);
        changed = true;
      }
    }
  }
  return set;
}

/** How many past states Undo can step back through in Files. */
const HISTORY_LIMIT = 30;

interface FsState {
  nodes: Record<string, FsNode>;
  hydrated: boolean;
  history: Record<string, FsNode>[];
  future: Record<string, FsNode>[];
  childrenOf: (parentId: string) => FsNode[];
  createFolder: (parentId: string, name: string) => string;
  createFile: (parentId: string, name: string, content?: string) => string;
  rename: (id: string, name: string) => void;
  /** Soft delete: moves the node (and descendants) to Trash. Reversible via `restore`. */
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
  restore: (id: string) => void;
  /** Hard delete: permanently removes the node and descendants. Not reversible. */
  permanentlyDelete: (id: string) => void;
  emptyTrash: () => void;
  move: (id: string, newParentId: string) => void;
  moveMany: (ids: string[], newParentId: string) => void;
  /** Deep-copies a node (and descendants) into a target folder with fresh ids. Returns the new node's id. */
  duplicate: (id: string, targetParentId: string) => string;
  duplicateMany: (ids: string[], targetParentId: string) => void;
  updateContent: (id: string, content: string) => void;
  getNode: (id: string) => FsNode | undefined;
  getPath: (id: string) => FsNode[];
  /** Recursive name/content search across the whole filesystem (Trash excluded). */
  search: (query: string) => FsNode[];
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
}

export const useFsStore = create<FsState>((set, get) => {
  /** Applies a new nodes map, recording the previous one on the undo stack. */
  function commit(next: Record<string, FsNode>) {
    set((s) => {
      const history = [...s.history, s.nodes].slice(-HISTORY_LIMIT);
      persist(next);
      return { nodes: next, history, future: [] };
    });
  }

  return {
  nodes: defaultNodes(),
  hydrated: false,
  history: [],
  future: [],

  childrenOf: (parentId) =>
    Object.values(get().nodes)
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1)),

  createFolder: (parentId, name) => {
    const id = createId("folder");
    const now = Date.now();
    commit({
      ...get().nodes,
      [id]: { id, type: "folder" as const, name, parentId, createdAt: now, updatedAt: now },
    });
    return id;
  },

  createFile: (parentId, name, content = "") => {
    const id = createId("file");
    const now = Date.now();
    commit({
      ...get().nodes,
      [id]: { id, type: "file" as const, name, parentId, content, createdAt: now, updatedAt: now },
    });
    return id;
  },

  rename: (id, name) => {
    const node = get().nodes[id];
    if (!node) return;
    commit({ ...get().nodes, [id]: { ...node, name, updatedAt: Date.now() } });
  },

  remove: (id) => get().removeMany([id]),

  removeMany: (ids) => {
    const nodes = { ...get().nodes };
    let changed = false;
    for (const id of ids) {
      const node = nodes[id];
      if (!node || id === TRASH_ID) continue;
      nodes[id] = { ...node, parentId: TRASH_ID, trashedFrom: node.parentId ?? ROOT_ID, updatedAt: Date.now() };
      changed = true;
    }
    if (changed) commit(nodes);
  },

  restore: (id) => {
    const node = get().nodes[id];
    if (!node) return;
    commit({
      ...get().nodes,
      [id]: { ...node, parentId: node.trashedFrom ?? ROOT_ID, trashedFrom: undefined, updatedAt: Date.now() },
    });
  },

  permanentlyDelete: (id) => {
    const toDelete = descendantsOf(get().nodes, id);
    commit(Object.fromEntries(Object.entries(get().nodes).filter(([nodeId]) => !toDelete.has(nodeId))));
  },

  emptyTrash: () => {
    const nodes = get().nodes;
    const toDelete = new Set<string>();
    for (const n of Object.values(nodes)) {
      if (n.parentId === TRASH_ID) descendantsOf(nodes, n.id).forEach((id) => toDelete.add(id));
    }
    commit(Object.fromEntries(Object.entries(nodes).filter(([nodeId]) => !toDelete.has(nodeId))));
  },

  move: (id, newParentId) => get().moveMany([id], newParentId),

  moveMany: (ids, newParentId) => {
    const nodes = { ...get().nodes };
    let changed = false;
    for (const id of ids) {
      const node = nodes[id];
      if (!node) continue;
      nodes[id] = { ...node, parentId: newParentId, updatedAt: Date.now() };
      changed = true;
    }
    if (changed) commit(nodes);
  },

  duplicate: (id, targetParentId) => {
    const source = get().nodes;
    const original = source[id];
    if (!original) return id;
    const idMap = new Map<string, string>();
    const toCopy = Array.from(descendantsOf(source, id)).sort((a, b) => (a === id ? -1 : b === id ? 1 : 0));
    const now = Date.now();
    const nodes = { ...source };
    for (const oldId of toCopy) {
      const node = source[oldId];
      const newId = createId(node.type);
      idMap.set(oldId, newId);
      nodes[newId] = {
        ...node,
        id: newId,
        name: oldId === id ? `${node.name} (copy)` : node.name,
        parentId: oldId === id ? targetParentId : idMap.get(node.parentId ?? "") ?? node.parentId,
        createdAt: now,
        updatedAt: now,
      };
    }
    commit(nodes);
    return idMap.get(id)!;
  },

  duplicateMany: (ids, targetParentId) => {
    for (const id of ids) get().duplicate(id, targetParentId);
  },

  updateContent: (id, content) => {
    const node = get().nodes[id];
    if (!node) return;
    commit({ ...get().nodes, [id]: { ...node, content, updatedAt: Date.now() } });
  },

  canUndo: () => get().history.length > 0,
  canRedo: () => get().future.length > 0,

  undo: () => {
    set((s) => {
      if (s.history.length === 0) return s;
      const previous = s.history[s.history.length - 1];
      persist(previous);
      return {
        nodes: previous,
        history: s.history.slice(0, -1),
        future: [s.nodes, ...s.future].slice(0, HISTORY_LIMIT),
      };
    });
  },

  redo: () => {
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      persist(next);
      return {
        nodes: next,
        history: [...s.history, s.nodes].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
      };
    });
  },

  getNode: (id) => get().nodes[id],

  getPath: (id) => {
    const path: FsNode[] = [];
    let current: FsNode | undefined = get().nodes[id];
    while (current) {
      path.unshift(current);
      current = current.parentId ? get().nodes[current.parentId] : undefined;
    }
    return path;
  },

  search: (query) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.values(get().nodes).filter(
      (n) => n.id !== TRASH_ID && n.parentId !== TRASH_ID && n.name.toLowerCase().includes(q)
    );
  },
  };
});

persistGet<Record<string, FsNode> | null>("data", STORAGE_KEY, null).then((loaded) => {
  const nodes = loaded && Object.keys(loaded).length > 0 ? loaded : defaultNodes();
  // Backfill Trash/Desktop for filesystems persisted before they existed.
  if (!nodes[TRASH_ID]) {
    nodes[TRASH_ID] = {
      id: TRASH_ID,
      type: "folder",
      name: "Trash",
      parentId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
  if (!nodes[DESKTOP_ID]) {
    nodes[DESKTOP_ID] = {
      id: DESKTOP_ID,
      type: "folder",
      name: "Desktop",
      parentId: ROOT_ID,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
  useFsStore.setState({ nodes, hydrated: true });
});
