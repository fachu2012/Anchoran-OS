import { useEffect, useRef, useState } from "react";
import { ANCHORAN_SIMPLIFIED_VERSION, simplifiedLabelFor } from "@/core/buildNumber";
import { AnchoranLogo } from "@/components/AnchoranLogo";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { ANCHORAN_CLASSIC_BLUE } from "@/theme/brandColor";

const FADE_MS = 500;

export function BootScreen({
  onDone,
  finishingUpdateVersion = null,
}: {
  onDone: () => void;
  finishingUpdateVersion?: string | null;
}) {
  if (finishingUpdateVersion) {
    return <FinishingUpdateBoot version={finishingUpdateVersion} onDone={onDone} />;
  }
  return <StandardBoot onDone={onDone} />;
}

// A Windows-style boot sequence, staged as its own set of hard cuts
// rather than smooth crossfades — each step below appears abruptly,
// the way a real OS boot does, instead of the softer macOS-style fade
// this screen used before:
//
//   black screen               (0s)
//   -> lone Anchoran icon      (after 1s, appears instantly, no animation)
//   -> loading bar at 0%       (after 2s more)
//   -> bar starts filling      (after 2s more, slow, with random pauses)
//   -> bar reaches 100%        (screen cuts back to black immediately)
//   -> lock screen             (after 1.5s of black — boot sequence done)
//
// The icon is deliberately always ANCHORAN_CLASSIC_BLUE, never the
// user's chosen accent color — see brandColor.ts for why.
const BLACK_BEFORE_LOGO_MS = 1000;
const LOGO_HOLD_BEFORE_BAR_MS = 2000;
const BAR_EMPTY_HOLD_MS = 2000;
const BLACK_AFTER_BAR_MS = 1500;

type BootPhase = "black" | "logo" | "bar-empty" | "bar-filling" | "black-after";

/**
 * Advances progress in uneven chunks with randomized pauses between
 * them — real disk/service loading doesn't move at a constant rate,
 * and a perfectly linear bar reads as fake. Occasionally stalls for a
 * longer beat (a "big pause"), same as a real boot bar visibly
 * catching up on something slow.
 */
function scheduleFillStep(setProgress: (updater: (p: number) => number) => void, onComplete: () => void, timers: ReturnType<typeof setTimeout>[]) {
  const step = () => {
    setProgress((p) => {
      if (p >= 100) return 100;
      const isBigPause = Math.random() < 0.22;
      const increment = isBigPause ? Math.round(3 + Math.random() * 6) : Math.round(6 + Math.random() * 16);
      const next = Math.min(100, p + increment);
      const delay = isBigPause ? 500 + Math.random() * 700 : 90 + Math.random() * 260;
      if (next >= 100) {
        onComplete();
      } else {
        timers.push(setTimeout(step, delay));
      }
      return next;
    });
  };
  step();
}

function StandardBoot({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<BootPhase>("black");
  const [progress, setProgress] = useState(0);
  const progressStarted = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase("logo"), BLACK_BEFORE_LOGO_MS));
    timers.push(
      setTimeout(() => setPhase("bar-empty"), BLACK_BEFORE_LOGO_MS + LOGO_HOLD_BEFORE_BAR_MS)
    );
    timers.push(
      setTimeout(() => {
        setPhase("bar-filling");
        if (progressStarted.current) return;
        progressStarted.current = true;
        scheduleFillStep(
          setProgress,
          () => {
            setPhase("black-after");
            timers.push(setTimeout(onDone, BLACK_AFTER_BAR_MS));
          },
          timers
        );
      }, BLACK_BEFORE_LOGO_MS + LOGO_HOLD_BEFORE_BAR_MS + BAR_EMPTY_HOLD_MS)
    );

    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  const showLogo = phase !== "black";
  const showBar = phase === "bar-empty" || phase === "bar-filling";
  const isBlackout = phase === "black" || phase === "black-after";

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
        gap: 36,
        zIndex: 2000,
      }}
    >
      {showLogo && <AnchoranLogo size={200} color={ANCHORAN_CLASSIC_BLUE} style={{ opacity: 0.98 }} />}

      {showBar && (
        <div
          style={{
            width: 340,
            height: 10,
            borderRadius: 5,
            background: "rgba(255,255,255,0.14)",
            overflow: "hidden",
            marginTop: 14,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              borderRadius: 5,
              background: "#F3F4F6",
              transition: "width 180ms ease-out",
            }}
          />
        </div>
      )}

      {!isBlackout && (
        <div
          style={{
            position: "absolute",
            bottom: 30,
            color: "rgba(243,244,246,0.28)",
            fontSize: 10.5,
            letterSpacing: 1,
          }}
        >
          {ANCHORAN_SIMPLIFIED_VERSION}
        </div>
      )}
    </div>
  );
}

const FINISHING_PHRASES = ["Just a bit more…", "Getting things ready…", "Almost there…", "Setting things up…"];
const FINISHING_TOTAL_MS = 8000;
const PHRASE_HOLD_MS = 1900;
const PHRASE_FADE_MS = 350;

/**
 * A silent install/update has no UI of its own to show while it runs
 * (the app has to quit for the installer to overwrite its own files —
 * see UpdateTheater). This boot is what confirms it actually finished:
 * no progress bar (there's nothing left to measure, the work already
 * happened), just a short, calm sequence of rotating reassurances
 * before the desktop appears.
 */
function FinishingUpdateBoot({ version, onDone }: { version: string; onDone: () => void }) {
  const accentColor = usePreferencesStore((s) => s.accentColor);
  const [phraseIndex, setPhraseIndex] = useState(-1); // -1 = show the version line first
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 900; // brief hold on the "Finishing update to vX" line first
    timers.push(setTimeout(() => setPhraseIndex(0), elapsed));

    let i = 0;
    while (elapsed + PHRASE_HOLD_MS < FINISHING_TOTAL_MS) {
      elapsed += PHRASE_HOLD_MS;
      i += 1;
      const index = i % FINISHING_PHRASES.length;
      timers.push(setTimeout(() => setPhraseIndex(index), elapsed));
    }

    timers.push(setTimeout(() => setVisible(false), FINISHING_TOTAL_MS));
    timers.push(setTimeout(onDone, FINISHING_TOTAL_MS + FADE_MS));

    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  const label =
    phraseIndex === -1
      ? `Finishing update to ${simplifiedLabelFor(version)}…`
      : FINISHING_PHRASES[phraseIndex];

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
        gap: 24,
        zIndex: 2000,
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <AnchoranLogo size={130} color={accentColor} style={{ opacity: 0.95 }} />
      <div
        key={phraseIndex}
        style={{
          color: "rgba(243,244,246,0.6)",
          fontSize: 13,
          letterSpacing: 0.4,
          animation: `finishing-phrase ${PHRASE_HOLD_MS}ms ease`,
        }}
      >
        {label}
      </div>
      <style>{`
        @keyframes finishing-phrase {
          0% { opacity: 0; }
          ${Math.round((PHRASE_FADE_MS / PHRASE_HOLD_MS) * 100)}% { opacity: 1; }
          ${100 - Math.round((PHRASE_FADE_MS / PHRASE_HOLD_MS) * 100)}% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
