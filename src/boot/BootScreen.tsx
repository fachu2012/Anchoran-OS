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
// rather than smooth crossfades — each step below appears/disappears
// abruptly, the way a real OS boot does:
//
//   black screen                (3s)
//   -> lone Anchoran icon       (5s — bar area reserved but invisible)
//   -> bar appears at 0%        (3s)
//   -> bar fills, random pauses (random 5-8s)
//   -> bar holds at 100%        (2s)
//   -> icon+bar vanish together (3s of black)
//   -> a nice fade into the lock screen (handled by LockScreen's own
//      mount animation, not here — see src/lock/LockScreen.tsx)
//
// The icon+bar's flex container never adds/removes either element from
// the layout — both are always mounted, toggled only via opacity — so
// the icon never visibly shifts position when the bar appears or
// disappears (a real bug in an earlier version of this screen: the bar
// being conditionally rendered changed the centered column's total
// height, nudging the icon up/down each time).
//
// The icon is deliberately always ANCHORAN_CLASSIC_BLUE, never the
// user's chosen accent color — see brandColor.ts for why.
const BLACK_MS = 3000;
const ICON_ONLY_MS = 5000;
const BAR_EMPTY_MS = 3000;
const BAR_FILL_MIN_MS = 5000;
const BAR_FILL_MAX_MS = 8000;
const BAR_FULL_HOLD_MS = 2000;
const BLACK_AFTER_MS = 3000;

type BootPhase = "black" | "icon-only" | "bar-empty" | "bar-filling" | "bar-full" | "black-after";

/**
 * Builds a full fill plan up front — random progress increments and
 * random per-step delays ("paros entremedio randoms") — sized so the
 * whole sequence takes close to `targetMs` (itself randomized between
 * BAR_FILL_MIN_MS and BAR_FILL_MAX_MS), rather than advancing forever
 * until 100% with no target duration. A step occasionally draws a much
 * bigger delay share, reading as the bar visibly stalling on something
 * slow, same as a real boot.
 */
function buildFillPlan(targetMs: number): { inc: number; delay: number }[] {
  const stepCount = 8 + Math.floor(Math.random() * 6); // 8-13 steps

  const incWeights = Array.from({ length: stepCount }, () => 0.3 + Math.random());
  const incSum = incWeights.reduce((a, b) => a + b, 0);
  const increments = incWeights.map((w) => Math.round((w / incSum) * 100));
  increments[increments.length - 1] += 100 - increments.reduce((a, b) => a + b, 0);

  const delayWeights = Array.from({ length: stepCount }, () => (Math.random() < 0.25 ? 2.5 + Math.random() * 2.5 : 0.4 + Math.random() * 0.9));
  const delaySum = delayWeights.reduce((a, b) => a + b, 0);
  const delays = delayWeights.map((w) => Math.round((w / delaySum) * targetMs));

  return increments.map((inc, i) => ({ inc, delay: delays[i] }));
}

function StandardBoot({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<BootPhase>("black");
  const [progress, setProgress] = useState(0);
  const fillStarted = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;

    timers.push(setTimeout(() => setPhase("icon-only"), (elapsed += BLACK_MS)));
    timers.push(setTimeout(() => setPhase("bar-empty"), (elapsed += ICON_ONLY_MS)));
    timers.push(
      setTimeout(() => {
        setPhase("bar-filling");
        if (fillStarted.current) return;
        fillStarted.current = true;

        const targetMs = BAR_FILL_MIN_MS + Math.random() * (BAR_FILL_MAX_MS - BAR_FILL_MIN_MS);
        const plan = buildFillPlan(targetMs);
        let stepElapsed = 0;
        let runningProgress = 0;
        plan.forEach(({ inc, delay }) => {
          stepElapsed += delay;
          runningProgress = Math.min(100, runningProgress + inc);
          const displayProgress = runningProgress;
          timers.push(setTimeout(() => setProgress(displayProgress), stepElapsed));
        });

        timers.push(
          setTimeout(() => {
            setProgress(100);
            setPhase("bar-full");
            timers.push(
              setTimeout(() => {
                setPhase("black-after");
                timers.push(setTimeout(onDone, BLACK_AFTER_MS));
              }, BAR_FULL_HOLD_MS)
            );
          }, stepElapsed)
        );
      }, (elapsed += BAR_EMPTY_MS))
    );

    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  const showIcon = phase !== "black" && phase !== "black-after";
  const showBar = phase === "bar-empty" || phase === "bar-filling" || phase === "bar-full";
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
      <AnchoranLogo size={200} color={ANCHORAN_CLASSIC_BLUE} style={{ opacity: showIcon ? 0.98 : 0 }} />

      {/* Always mounted, fixed size — reserving this space is what
          keeps the icon from shifting when the bar's own visibility
          toggles (see the note above the timing constants). */}
      <div
        style={{
          width: 340,
          height: 10,
          borderRadius: 5,
          background: "rgba(255,255,255,0.14)",
          overflow: "hidden",
          marginTop: 14,
          opacity: showBar ? 1 : 0,
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
