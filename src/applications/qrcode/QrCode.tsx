import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./qrcode.css";

export function QrCodeApp() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const qrUrl = useMemo(() => {
    const value = text.trim();
    if (!value) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(value)}`;
  }, [text]);

  useEffect(() => {
    setLoadFailed(false);
  }, [qrUrl]);

  function copyImageUrl() {
    if (!qrUrl) return;
    navigator.clipboard?.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="app-root">
      <div className="app-content qrcode-content">
        <textarea
          className="qrcode-input"
          placeholder="Enter text or a link…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        <div className="qrcode-preview">
          {qrUrl && !loadFailed ? (
            <img
              src={qrUrl}
              alt="Generated QR code"
              width={220}
              height={220}
              onError={() => setLoadFailed(true)}
            />
          ) : qrUrl && loadFailed ? (
            <div className="qrcode-placeholder">Couldn't load the QR code. Check your connection.</div>
          ) : (
            <div className="qrcode-placeholder">Your QR code will appear here</div>
          )}
        </div>
        {qrUrl && (
          <button className="app-toolbar-btn" onClick={copyImageUrl}>
            <Icon name="copy" size={14} /> {copied ? "Copied" : "Copy image link"}
          </button>
        )}
      </div>
    </div>
  );
}
