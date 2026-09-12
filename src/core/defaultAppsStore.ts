import { create } from "zustand";
import { persistGet, persistSet } from "@/core/persist";

/**
 * Which app Files hands a file off to for each broad category —
 * configurable in Settings instead of the hardcoded choice Anchoran
 * shipped with initially (Photo Viewer for images, Notes for text,
 * Media Player for audio/video, Quick Look's archive view for zips).
 * "external" means: skip Anchoran's own app and open the file with
 * its real Windows default app instead, the same fallback already
 * used for file types Anchoran has no app for at all.
 */
export interface DefaultAppsState {
  images: "photoViewer" | "external";
  text: "notes" | "external";
  audioVideo: "mediaPlayer" | "external";
  zip: "quickLook" | "external";
  hydrated: boolean;
  setDefault: <K extends "images" | "text" | "audioVideo" | "zip">(category: K, value: DefaultAppsState[K]) => void;
}

const STORAGE_KEY = "defaultApps";

function persist(state: Pick<DefaultAppsState, "images" | "text" | "audioVideo" | "zip">) {
  persistSet("config", STORAGE_KEY, state);
}

export const useDefaultAppsStore = create<DefaultAppsState>((set, get) => ({
  images: "photoViewer",
  text: "notes",
  audioVideo: "mediaPlayer",
  zip: "quickLook",
  hydrated: false,

  setDefault: (category, value) => {
    set({ [category]: value } as Partial<DefaultAppsState>);
    const { images, text, audioVideo, zip } = get();
    persist({ images, text, audioVideo, zip, ...{ [category]: value } });
  },
}));

persistGet<Pick<DefaultAppsState, "images" | "text" | "audioVideo" | "zip">>("config", STORAGE_KEY, {
  images: "photoViewer",
  text: "notes",
  audioVideo: "mediaPlayer",
  zip: "quickLook",
}).then((loaded) => {
  useDefaultAppsStore.setState({ ...loaded, hydrated: true });
});
