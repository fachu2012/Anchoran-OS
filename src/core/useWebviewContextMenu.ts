import { useEffect, type RefObject } from "react";

interface WebviewElement extends HTMLElement {
  getWebContentsId: () => number;
}

interface ContextMenuEvent extends Event {
  params: { isEditable: boolean; selectionText: string; linkURL: string; srcURL: string; hasImageContents: boolean; x: number; y: number };
}

/**
 * `<webview>` guest pages don't get a real right-click menu on their
 * own (see electron/main.ts's "anchoran:webview-context-menu" handler
 * for why and how) — this wires a webview element up to get one,
 * shared by every app that embeds a `<webview>`.
 */
export function useWebviewContextMenu(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current as WebviewElement | null;
    if (!el || !window.anchoran) return;

    function onContextMenu(e: Event) {
      const event = e as ContextMenuEvent;
      const webContentsId = el!.getWebContentsId();
      window.anchoran!.showWebviewContextMenu(webContentsId, event.params.x, event.params.y, {
        isEditable: event.params.isEditable,
        selectionText: event.params.selectionText,
        linkURL: event.params.linkURL,
        srcURL: event.params.srcURL,
        hasImageContents: event.params.hasImageContents,
      });
    }

    el.addEventListener("context-menu", onContextMenu);
    return () => el.removeEventListener("context-menu", onContextMenu);
  }, [ref]);
}
