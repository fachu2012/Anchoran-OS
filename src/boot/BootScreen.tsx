import { useEffect, useState } from "react";
import { ANCHORAN_VERSION } from "@/core/version";

const ANCHORAN_LOGO = new URL("../../assets/logo/anchoran-logo.svg", import.meta.url).href;

const HOLD_MS = 1500;
const FADE_MS = 350;

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), HOLD_MS);
    const done = setTimeout(onDone, HOLD_MS + FADE_MS);
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
        background: "#08090D",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
        zIndex: 2000,
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <img
        src={ANCHORAN_LOGO}
        alt=""
        width={68}
        height={68}
        style={{ opacity: 0.95, animation: "boot-logo-in 650ms cubic-bezier(0.16,1,0.3,1)" }}
      />
      <div
        style={{
          color: "#F3F4F6",
          fontSize: 19,
          letterSpacing: 3,
          fontWeight: 300,
          animation: "boot-text-in 650ms cubic-bezier(0.16,1,0.3,1) 110ms backwards",
        }}
      >
        ANCHORAN OS
      </div>
      <div
        style={{
          width: 120,
          height: 2,
          borderRadius: 2,
          background: "rgba(243,244,246,0.12)",
          overflow: "hidden",
          animation: "boot-text-in 650ms cubic-bezier(0.16,1,0.3,1) 220ms backwards",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "40%",
            borderRadius: 2,
            background: "linear-gradient(90deg, transparent, #6E9BF7, transparent)",
            animation: "boot-progress 1100ms cubic-bezier(0.4,0,0.2,1) 260ms infinite",
          }}
        />
      </div>
      <div
        style={{
          color: "rgba(243,244,246,0.34)",
          fontSize: 10.5,
          letterSpacing: 1,
          animation: "boot-text-in 650ms cubic-bezier(0.16,1,0.3,1) 300ms backwards",
        }}
      >
        v{ANCHORAN_VERSION}
      </div>
      <style>{`
        @keyframes boot-logo-in {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 0.95; transform: scale(1); }
        }
        @keyframes boot-text-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes boot-progress {
          from { transform: translateX(-120%); }
          to { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
