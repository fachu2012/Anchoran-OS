import "@/applications/apps.css";

// The user's own chat app (Firebase-backed, their project) — embedded
// the same way the Browser app embeds any site, but as its own
// dedicated window instead of a general-purpose address bar.
const CHAT_URL = "https://fprichat.vercel.app/";
const isElectron = typeof window !== "undefined" && !!window.anchoran;

export function ChatApp() {
  return (
    <div className="app-root">
      <div className="app-content" style={{ padding: 0 }}>
        {isElectron ? (
          <webview src={CHAT_URL} style={{ width: "100%", height: "100%", display: "flex" }} />
        ) : (
          <iframe
            title="Anchoran Chat"
            src={CHAT_URL}
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          />
        )}
      </div>
    </div>
  );
}
