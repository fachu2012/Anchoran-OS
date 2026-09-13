import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";

export const TAG_COLORS = ["red", "orange", "yellow", "green", "blue", "purple"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export const TAG_COLOR_HEX: Record<TagColor, string> = {
  red: "#E5484D",
  orange: "#F76B15",
  yellow: "#F5D90A",
  green: "#30A46C",
  blue: "#3E7BFA",
  purple: "#8E4EC6",
};

const KEY = "fileColorTags";

interface FileTagsState {
  tags: Record<string, TagColor>;
  setTag: (path: string, color: TagColor | null) => void;
}

/** A color tag per real file/folder path — a lightweight, personal-organization label independent of the file's actual type or name, the same idea as color tags in a real file manager. */
export const useFileTagsStore = create<FileTagsState>((set, get) => ({
  tags: {},
  setTag: (path, color) => {
    const tags = { ...get().tags };
    if (color) tags[path] = color;
    else delete tags[path];
    set({ tags });
    persistSet("config", KEY, tags);
  },
}));

persistGet<Record<string, TagColor>>("config", KEY, {}).then((tags) => {
  useFileTagsStore.setState({ tags });
});
