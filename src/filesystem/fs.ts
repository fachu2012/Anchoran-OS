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
    downloads: mk("downloads", "folder", "Downloads", ROOT_ID),
    notes: mk("notes", "folder", "Notes", ROOT_ID),
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

interface FsState {
  nodes: Record<string, FsNode>;
  hydrated: boolean;
  childrenOf: (parentId: string) => FsNode[];
  createFolder: (parentId: string, name: string) => string;
  createFile: (parentId: string, name: string, content?: string) => string;
  rename: (id: string, name: string) => void;
  /** Soft delete: moves the node (and descendants) to Trash. Reversible via `restore`. */
  remove: (id: string) => void;
  restore: (id: string) => void;
  /** Hard delete: permanently removes the node and descendants. Not reversible. */
  permanentlyDelete: (id: string) => void;
  emptyTrash: () => void;
  move: (id: string, newParentId: string) => void;
  updateContent: (id: string, content: string) => void;
  getNode: (id: string) => FsNode | undefined;
  getPath: (id: string) => FsNode[];
  /** Recursive name/content search across the whole filesystem (Trash excluded). */
  search: (query: string) => FsNode[];
}

export const useFsStore = create<FsState>((set, get) => ({
  nodes: defaultNodes(),
  hydrated: false,

  childrenOf: (parentId) =>
    Object.values(get().nodes)
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1)),

  createFolder: (parentId, name) => {
    const id = createId("folder");
    const now = Date.now();
    set((s) => {
      const nodes = {
        ...s.nodes,
        [id]: { id, type: "folder" as const, name, parentId, createdAt: now, updatedAt: now },
      };
      persist(nodes);
      return { nodes };
    });
    return id;
  },

  createFile: (parentId, name, content = "") => {
    const id = createId("file");
    const now = Date.now();
    set((s) => {
      const nodes = {
        ...s.nodes,
        [id]: { id, type: "file" as const, name, parentId, content, createdAt: now, updatedAt: now },
      };
      persist(nodes);
      return { nodes };
    });
    return id;
  },

  rename: (id, name) => {
    set((s) => {
      const node = s.nodes[id];
      if (!node) return s;
      const nodes = { ...s.nodes, [id]: { ...node, name, updatedAt: Date.now() } };
      persist(nodes);
      return { nodes };
    });
  },

  remove: (id) => {
    set((s) => {
      const node = s.nodes[id];
      if (!node || id === TRASH_ID) return s;
      const nodes = {
        ...s.nodes,
        [id]: { ...node, parentId: TRASH_ID, trashedFrom: node.parentId ?? ROOT_ID, updatedAt: Date.now() },
      };
      persist(nodes);
      return { nodes };
    });
  },

  restore: (id) => {
    set((s) => {
      const node = s.nodes[id];
      if (!node) return s;
      const nodes = {
        ...s.nodes,
        [id]: { ...node, parentId: node.trashedFrom ?? ROOT_ID, trashedFrom: undefined, updatedAt: Date.now() },
      };
      persist(nodes);
      return { nodes };
    });
  },

  permanentlyDelete: (id) => {
    set((s) => {
      const toDelete = descendantsOf(s.nodes, id);
      const nodes = Object.fromEntries(
        Object.entries(s.nodes).filter(([nodeId]) => !toDelete.has(nodeId))
      );
      persist(nodes);
      return { nodes };
    });
  },

  emptyTrash: () => {
    set((s) => {
      const toDelete = new Set<string>();
      for (const n of Object.values(s.nodes)) {
        if (n.parentId === TRASH_ID) descendantsOf(s.nodes, n.id).forEach((id) => toDelete.add(id));
      }
      const nodes = Object.fromEntries(
        Object.entries(s.nodes).filter(([nodeId]) => !toDelete.has(nodeId))
      );
      persist(nodes);
      return { nodes };
    });
  },

  move: (id, newParentId) => {
    set((s) => {
      const node = s.nodes[id];
      if (!node) return s;
      const nodes = { ...s.nodes, [id]: { ...node, parentId: newParentId, updatedAt: Date.now() } };
      persist(nodes);
      return { nodes };
    });
  },

  updateContent: (id, content) => {
    set((s) => {
      const node = s.nodes[id];
      if (!node) return s;
      const nodes = { ...s.nodes, [id]: { ...node, content, updatedAt: Date.now() } };
      persist(nodes);
      return { nodes };
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
}));

persistGet<Record<string, FsNode> | null>("data", STORAGE_KEY, null).then((loaded) => {
  const nodes = loaded && Object.keys(loaded).length > 0 ? loaded : defaultNodes();
  // Backfill Trash for filesystems persisted before Trash existed.
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
  useFsStore.setState({ nodes, hydrated: true });
});
