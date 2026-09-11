import { useEffect, useState } from "react";

const ANCHORAN_LOGO = new URL("../../assets/logo/anchoran-logo.svg", import.meta.url).href;

export type ExitMode = "shutdown" | "restart" | "sleep";

const LABELS: Record<ExitMode, string> = {
  shutdown: "Shutting down Anchoran…",
  restart: "Restarting Anchoran…",
  sleep: "Anchoran is sleeping",
};

const DIM_MS = 350;
const HOLD_MS = 900;
const BLACKOUT_MS = 400;

/**
 * Full-screen overlay shown while Anchoran winds down: it dims in over
 * the still-visible desktop, holds on the logo/label so the transition
 * reads as deliberate rather than an abrupt cut, then fades to black
 * before calling back so the caller can perform the real exit/restart/
 * lock action once the animation has finished.
 */
export function ShutdownScreen({ mode, onComplete }: { mode: ExitMode; onComplete: () => void }) {
  const [stage, setStage] = useState<"dimming" | "holding" | "blackout">("dimming");

  useEffect(() => {
    const t1 = setTimeout(() => setStage("holding"), DIM_MS);
    const t2 = setTimeout(() => setStage("blackout"), DIM_MS + HOLD_MS);
    const t3 = setTimeout(onComplete, DIM_MS + HOLD_MS + BLACKOUT_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  const overlayOpacity = stage === "dimming" ? 0 : stage === "blackout" ? 1 : 0.94;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        background: "#08090D",
        opacity: overlayOpacity,
        transition: `opacity ${stage === "blackout" ? BLACKOUT_MS : DIM_MS}ms cubic-bezier(0.4,0,0.4,1)`,
      }}
    >
      <img
        src={ANCHORAN_LOGO}
        alt=""
        width={60}
        height={60}
        style={{
          opacity: stage === "blackout" ? 0 : 0.88,
          transform: stage === "blackout" ? "scale(0.9)" : "scale(1)",
          transition: `opacity ${BLACKOUT_MS}ms ease, transform ${BLACKOUT_MS}ms ease`,
        }}
      />
      <div
        style={{
          color: "#F3F4F6",
          fontSize: 14,
          letterSpacing: 0.5,
          fontWeight: 300,
          opacity: stage === "blackout" ? 0 : 0.8,
          transition: `opacity ${BLACKOUT_MS}ms ease`,
        }}
      >
        {LABELS[mode]}
      </div>
    </div>
  );
}
