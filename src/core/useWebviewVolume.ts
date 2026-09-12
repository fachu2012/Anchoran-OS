import { useEffect, type RefObject } from "react";
import type { AppId } from "@/core/types";
import { useVolumeMixerStore } from "@/desktop/volumeMixerStore";

interface WebviewElement extends HTMLElement {
  setAudioMuted: (muted: boolean) => void;
  executeJavaScript: (code: string) => Promise<unknown>;
}

/**
 * Applies this app's volume-mixer level to a `<webview>` guest page —
 * `setAudioMuted` is a real Electron API (mutes the guest's actual
 * audio output at the Chromium level), and since there's no equivalent
 * native "set volume" for a guest page, the volume level itself is
 * applied by setting `.volume` on every media element inside it via
 * `executeJavaScript`. Re-applied on every page load (`dom-ready`)
 * since a fresh page has fresh media elements, and on every mixer
 * change.
 */
export function useWebviewVolume(appId: AppId, ref: RefObject<HTMLElement | null>) {
  const level = useVolumeMixerStore((s) => s.getLevel(appId));

  useEffect(() => {
    const el = ref.current as WebviewElement | null;
    if (!el) return;

    function apply() {
      const webview = ref.current as WebviewElement | null;
      if (!webview) return;
      webview.setAudioMuted(level.muted);
      webview
        .executeJavaScript(`document.querySelectorAll('audio,video').forEach(el => { el.volume = ${level.volume}; });`)
        .catch(() => {});
    }

    apply();
    el.addEventListener("dom-ready", apply);
    return () => el.removeEventListener("dom-ready", apply);
  }, [appId, ref, level.volume, level.muted]);
}
