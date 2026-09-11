import { useEffect, useState } from "react";
import { ANCHORAN_VERSION } from "@/core/version";

const ANCHORAN_LOGO = new URL("../../assets/logo/anchoran-logo.svg", import.meta.url).href;

// A deliberately slow, staged boot sequence: black screen first, then
// the icon alone, then the wordmark, then a thick macOS-style loading
// bar that actually takes its time — closer to a real OS boot than a
// splash flash. Total runtime is intentionally ~6.5s.
const LOGO_AT = 700;
const WORDMARK_AT = 1650;
const BAR_AT = 2150;
const BAR_FILL_MS = 3600;
const HOLD_AFTER_BAR_MS = 350;
const FADE_MS = 500;

const HOLD_MS = BAR_AT + BAR_FILL_MS + HOLD_AFTER_BAR_MS;

const STATUS_STAGES = [
  { at: 0, label: "" },
  { at: BAR_AT, label: "Starting Anchoran OS…" },
  { at: BAR_AT + BAR_FILL_MS * 0.35, label: "Loading desktop environment…" },
  { at: BAR_AT + BAR_FILL_MS * 0.7, label: "Preparing your workspace…" },
  { at: BAR_AT + BAR_FILL_MS * 0.92, label: "Almost there…" },
];

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const [showLogo, setShowLogo] = useState(false);
  const [showWordmark, setShowWordmark] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setShowLogo(true), LOGO_AT),
      setTimeout(() => setShowWordmark(true), WORDMARK_AT),
      setTimeout(() => setShowBar(true), BAR_AT),
      ...STATUS_STAGES.map((s, i) => setTimeout(() => setStatusIndex(i), s.at)),
    ];

    let raf = 0;
    const barStart = performance.now() + BAR_AT;
    function tick(now: number) {
      const elapsed = now - barStart;
      if (elapsed >= 0) {
        setProgress(Math.min(100, Math.round((elapsed / BAR_FILL_MS) * 100)));
      }
      if (elapsed < BAR_FILL_MS) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    const hide = setTimeout(() => setVisible(false), HOLD_MS);
    const done = setTimeout(onDone, HOLD_MS + FADE_MS);
    timers.push(hide, done);

    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, [onDone]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 30,
        zIndex: 2000,
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <img
        src={ANCHORAN_LOGO}
        alt=""
        width={84}
        height={84}
        style={{
          opacity: showLogo ? 0.96 : 0,
          transform: showLogo ? "scale(1)" : "scale(0.82)",
          transition: "opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)",
        }}
      />
      <div
        style={{
          color: "#F3F4F6",
          fontSize: 20,
          letterSpacing: 3,
          fontWeight: 300,
          opacity: showWordmark ? 1 : 0,
          transform: showWordmark ? "none" : "translateY(6px)",
          transition: "opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        ANCHORAN OS
      </div>

      {/* Thick, macOS-style loading bar. */}
      <div
        style={{
          width: 260,
          height: 8,
          borderRadius: 4,
          background: "rgba(255,255,255,0.14)",
          overflow: "hidden",
          opacity: showBar ? 1 : 0,
          transition: "opacity 500ms ease",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            borderRadius: 4,
            background: "#F3F4F6",
            transition: "width 120ms linear",
          }}
        />
      </div>

      <div
        style={{
          color: "rgba(243,244,246,0.42)",
          fontSize: 11.5,
          letterSpacing: 0.4,
          height: 15,
          opacity: showBar ? 1 : 0,
          transition: "opacity 400ms ease",
        }}
      >
        {STATUS_STAGES[statusIndex].label}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 30,
          color: "rgba(243,244,246,0.28)",
          fontSize: 10.5,
          letterSpacing: 1,
        }}
      >
        v{ANCHORAN_VERSION}
      </div>
    </div>
  );
}
