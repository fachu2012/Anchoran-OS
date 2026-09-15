import { useEffect, useState } from "react";
import { AnchoranLogo } from "@/components/AnchoranLogo";
import { ANCHORAN_CLASSIC_BLUE } from "@/theme/brandColor";

export type TheaterMode = "update" | "install";

const COPY: Record<TheaterMode, { verb: string; working: string; blurb: string }> = {
  update: {
    verb: "Updating",
    working: "Working on updates",
    blurb: "Updating Anchoran OS might take a while, and it could restart itself several times. Don't turn off your PC.",
  },
  install: {
    verb: "Installing",
    working: "Setting up Anchoran OS",
    blurb: "Installing Anchoran OS might take a while, and it could restart itself several times. Don't turn off your PC.",
  },
};

const RESTART_FLASH_MS = 550;
const MIN_CYCLE_MS = 7000;
const MAX_CYCLE_MS = 12000;

function randomInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min));
}

type Phase = "restarting" | "working" | "flashing";

/**
 * The pre-quit "installing/updating" theater, styled after Windows'
 * own Update/Setup experience: a held "Working on updates" screen with
 * a determinate-feeling progress bar, interrupted by a handful of
 * simulated restart cycles (1-3, each 7-12s apart) — a black flash and
 * back. This entire sequence runs inside the still-open, still-running
 * Anchoran window: nothing here is the *real* install (which, for an
 * update, only happens after `onComplete` fires and the app actually
 * quits — see the Windows-key-style caveat about that gap in
 * App.tsx/ShutdownScreen). It exists purely so "updating" reads as
 * substantial and Anchoran never appears to just vanish mid-action.
 */
export function UpdateTheater({
  mode,
  targetVersion,
  onComplete,
}: {
  mode: TheaterMode;
  targetVersion: string;
  onComplete: () => void;
}) {
  const copy = COPY[mode];
  const [restartsRemaining] = useState(() => randomInt(1, 4)); // 1-3
  const [cyclesDone, setCyclesDone] = useState(0);
  const [phase, setPhase] = useState<Phase>("restarting");
  const [percent, setPercent] = useState(0);

  // "Restarting…" beat before the main working screen appears.
  useEffect(() => {
    if (phase !== "restarting") return;
    const t = setTimeout(() => setPhase("working"), 1100);
    return () => clearTimeout(t);
  }, [phase]);

  // Determinate-feeling progress within the current working stretch.
  useEffect(() => {
    if (phase !== "working") return;
    setPercent(0);
    const duration = randomInt(MIN_CYCLE_MS, MAX_CYCLE_MS);
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const elapsed = now - start;
      setPercent(Math.min(100, Math.round((elapsed / duration) * 100)));
      if (elapsed < duration) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    const t = setTimeout(() => {
      if (cyclesDone + 1 >= restartsRemaining) {
        onComplete();
      } else {
        setPhase("flashing");
      }
    }, duration);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cyclesDone]);

  // Brief blank "restart" flash between working stretches.
  useEffect(() => {
    if (phase !== "flashing") return;
    const t = setTimeout(() => {
      setCyclesDone((c) => c + 1);
      setPhase("working");
    }, RESTART_FLASH_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const blank = phase === "flashing" || phase === "restarting";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 2100,
        background: "#08090D",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        transition: "opacity 250ms ease",
      }}
    >
      {!blank && (
        <>
          <AnchoranLogo size={56} color={ANCHORAN_CLASSIC_BLUE} style={{ opacity: 0.9 }} />
          <div style={{ color: "#F3F4F6", fontSize: 17, fontWeight: 300 }}>{copy.working}</div>
          <div style={{ width: 220, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${percent}%`,
                background: ANCHORAN_CLASSIC_BLUE,
                borderRadius: 2,
                transition: "width 120ms linear",
              }}
            />
          </div>
          <div style={{ color: "rgba(243,244,246,0.4)", fontSize: 11.5 }}>{percent}%</div>
          <div style={{ color: "rgba(243,244,246,0.42)", fontSize: 12, maxWidth: 380, textAlign: "center", lineHeight: 1.6, marginTop: 6 }}>
            {copy.blurb}
          </div>
          <div style={{ color: "rgba(243,244,246,0.24)", fontSize: 10.5, marginTop: 20 }}>
            {copy.verb} to v{targetVersion}
          </div>
        </>
      )}
      {phase === "restarting" && (
        <div style={{ position: "absolute", color: "rgba(243,244,246,0.5)", fontSize: 12.5 }}>Restarting…</div>
      )}
    </div>
  );
}
