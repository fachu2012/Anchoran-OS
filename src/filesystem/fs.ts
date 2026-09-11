import { create } from "zustand";

/**
 * Anchoran's own virtual filesystem. It is entirely separate from the
 * real Windows filesystem: nothing here reads or writes host files.
 * It persists to localStorage under its own namespace, mirroring the
 * "data / config / apps / cache / logs / assets" separation described
 * in the architecture.
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
}

const STORAGE_KEY = "anchoran.filesystem.v1";
export const ROOT_ID = "root";

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
  };
}

function load(): Record<string, FsNode> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultNodes();
    return JSON.parse(raw);
  } catch {
    return defaultNodes();
  }
}

function persist(nodes: Record<string, FsNode>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
  } catch {
    // Best-effort persistence only.
  }
}

let idCounter = 0;
function createId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

interface FsState {
  nodes: Record<string, FsNode>;
  childrenOf: (parentId: string) => FsNode[];
  createFolder: (parentId: string, name: string) => string;
  createFile: (parentId: string, name: string, content?: string) => string;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  move: (id: string, newParentId: string) => void;
  updateContent: (id: string, content: string) => void;
  getNode: (id: string) => FsNode | undefined;
  getPath: (id: string) => FsNode[];
}

export const useFsStore = create<FsState>((set, get) => ({
  nodes: load(),

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
      const toDelete = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const n of Object.values(s.nodes)) {
          if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
            toDelete.add(n.id);
            changed = true;
          }
        }
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
    let current = get().nodes[id];
    while (current) {
      path.unshift(current);
      current = current.parentId ? get().nodes[current.parentId] : undefined;
    }
    return path;
  },
}));
