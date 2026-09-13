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
  /**
   * Code files (see fileTypes.ts's CODE_EXT) open into the Code Runner
   * by default — clicking runs the file instead of opening it for
   * editing, the same way a real IDE's "Run" button works. Editing is
   * still one right-click away via "Edit as Text" regardless of this
   * setting; this only controls what a plain click/double-click does.
   */
  code: "codeRunner" | "external";
  hydrated: boolean;
  setDefault: <K extends "images" | "text" | "audioVideo" | "zip" | "code">(category: K, value: DefaultAppsState[K]) => void;
}

const STORAGE_KEY = "defaultApps";

function persist(state: Pick<DefaultAppsState, "images" | "text" | "audioVideo" | "zip" | "code">) {
  persistSet("config", STORAGE_KEY, state);
}

export const useDefaultAppsStore = create<DefaultAppsState>((set, get) => ({
  images: "photoViewer",
  text: "notes",
  audioVideo: "mediaPlayer",
  zip: "quickLook",
  code: "codeRunner",
  hydrated: false,

  setDefault: (category, value) => {
    set({ [category]: value } as Partial<DefaultAppsState>);
    const { images, text, audioVideo, zip, code } = get();
    persist({ images, text, audioVideo, zip, code, ...{ [category]: value } });
  },
}));

persistGet<Pick<DefaultAppsState, "images" | "text" | "audioVideo" | "zip" | "code">>("config", STORAGE_KEY, {
  images: "photoViewer",
  text: "notes",
  audioVideo: "mediaPlayer",
  zip: "quickLook",
  code: "codeRunner",
}).then((loaded) => {
  useDefaultAppsStore.setState({ ...loaded, hydrated: true });
});
