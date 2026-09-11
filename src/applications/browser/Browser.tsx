import { useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";

function normalizeUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  return `https://${input}`;
}

const isElectron = typeof window !== "undefined" && !!window.anchoran;

export function BrowserApp() {
  const [urlInput, setUrlInput] = useState("https://www.anthropic.com");
  const [activeUrl, setActiveUrl] = useState(urlInput);

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
          <webview src={activeUrl} style={{ width: "100%", height: "100%", display: "flex" }} />
        ) : (
          <iframe
            title="Anchoran Browser"
            src={activeUrl}
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          />
        )}
      </div>
    </div>
  );
}
