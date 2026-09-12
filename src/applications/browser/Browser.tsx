import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useWebviewContextMenu } from "@/core/useWebviewContextMenu";
import { useWebviewVolume } from "@/core/useWebviewVolume";
import "@/applications/apps.css";

/**
 * A real browser embedded inside Anchoran itself — Electron's
 * `<webview>` runs the actual Chromium engine (the same rendering core
 * Google Chrome is built on), as its own separate guest process, so
 * real sites load normally. It is deliberately NOT labeled "Google
 * Chrome" or any other real product name: it's genuinely Chromium
 * underneath, but it isn't the Google-branded product with its account
 * sync, extensions, or updates, and calling it that would be
 * misleading. It's also deliberately kept inside Anchoran's own
 * window rather than launching a separate real Chrome process outside
 * it — the whole point is that it's part of the OS shell, not a
 * detour out of it.
 */
function normalizeUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  return `https://${input}`;
}

const isElectron = typeof window !== "undefined" && !!window.anchoran;

export function BrowserApp() {
  const [urlInput, setUrlInput] = useState("https://www.google.com");
  const [activeUrl, setActiveUrl] = useState(urlInput);
  const webviewRef = useRef<HTMLElement>(null);
  useWebviewContextMenu(webviewRef);
  useWebviewVolume("browser", webviewRef);

  function navigate() {
    setActiveUrl(normalizeUrl(urlInput));
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <Icon name="browser" size={16} />
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate()}
          style={{
            flex: 1,
            border: "1px solid var(--anchoran-border)",
            borderRadius: 6,
            padding: "6px 10px",
            background: "var(--anchoran-bg)",
            color: "var(--anchoran-text-primary)",
            fontSize: 12.5,
          }}
        />
        <button className="app-toolbar-btn" onClick={navigate}>Go</button>
      </div>
      <div className="app-content" style={{ padding: 0 }}>
        {isElectron ? (
          // <webview> is a separate guest process/renderer, so unlike an
          // <iframe> it isn't blocked by a site's X-Frame-Options / CSP
          // frame-ancestors — most real sites load here.
          <webview ref={webviewRef as never} src={activeUrl} style={{ width: "100%", height: "100%", display: "flex" }} />
        ) : (
          <iframe
            title="Browser"
            src={activeUrl}
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          />
        )}
      </div>
    </div>
  );
}
