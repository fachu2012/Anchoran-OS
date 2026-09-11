import type { DetailedHTMLProps, HTMLAttributes } from "react";

/**
 * Minimal typing for Electron's <webview> tag so the Browser app can
 * use it from React/TSX. Electron ships its own JSX augmentation, but
 * the renderer's tsconfig intentionally doesn't pull in Node/Electron
 * ambient types (it's browser-shaped), so it's declared narrowly here
 * instead — only the attributes Anchoran actually uses.
 */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        allowpopups?: string;
        partition?: string;
      };
    }
  }
}

export {};
