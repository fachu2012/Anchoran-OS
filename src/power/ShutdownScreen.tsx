import { useEffect, useState } from "react";
import { AnchoranLogo } from "@/components/AnchoranLogo";
import { usePreferencesStore } from "@/theme/preferencesStore";

// "update" used to be a mode here too, but the update flow now has its
// own, much more elaborate pre-install sequence — see UpdateTheater.
export type ExitMode = "shutdown" | "restart" | "sleep";

const DIM_MS = 380;
const HOLD_MS = 2100;
const BLACKOUT_MS = 450;

/**
 * Full-screen overlay shown while Anchoran winds down: it dims in over
 * the still-visible desktop, holds through a short staged sequence so
 * the transition reads as deliberate rather than an abrupt cut, then
 * fades to black before calling back so the caller can perform the
 * real exit/restart/lock action once the animation has finished.
 */
export function ShutdownScreen({ mode, onComplete }: { mode: ExitMode; onComplete: () => void }) {
  const accentColor = usePreferencesStore((s) => s.accentColor);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete, mode]);

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
      <div
        style={{
          width: 170,
          height: 170,
          borderRadius: 38,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: stage === "blackout" ? 0 : 1,
          transform: stage === "blackout" ? "scale(0.9)" : "scale(1)",
          transition: `opacity ${BLACKOUT_MS}ms ease, transform ${BLACKOUT_MS}ms ease`,
        }}
      >
        <AnchoranLogo size={110} color={accentColor} style={{ opacity: 0.92 }} />
      </div>
      <div
        style={{
          width: 260,
          height: 6,
          borderRadius: 3,
          background: "rgba(243,244,246,0.12)",
          overflow: "hidden",
          opacity: stage === "blackout" ? 0 : 1,
          transition: `opacity ${BLACKOUT_MS}ms ease`,
          marginTop: 14,
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 3,
            background: accentColor,
            width: stage === "dimming" ? "0%" : "100%",
            transition: `width ${HOLD_MS}ms linear`,
          }}
        />
      </div>
    </div>
  );
}
