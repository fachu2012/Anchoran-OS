import { useEffect, useState } from "react";
import { ANCHORAN_VERSION } from "@/core/version";

const LOGO_PLACEHOLDER = new URL(
  "../../assets/logo/anchoran-logo-placeholder.svg",
  import.meta.url
).href;

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), 1400);
    const done = setTimeout(onDone, 1700);
    return () => {
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#0B0E14",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        zIndex: 2000,
        opacity: visible ? 1 : 0,
        transition: "opacity 300ms ease",
        pointerEvents: "none",
      }}
    >
      <img src={LOGO_PLACEHOLDER} alt="" width={72} height={72} style={{ opacity: 0.92 }} />
      <div style={{ color: "#F2F3F5", fontSize: 20, letterSpacing: 2, fontWeight: 300 }}>
        ANCHORAN OS
      </div>
      <div style={{ color: "rgba(242,243,245,0.4)", fontSize: 11, letterSpacing: 1 }}>
        v{ANCHORAN_VERSION}
      </div>
    </div>
  );
}
