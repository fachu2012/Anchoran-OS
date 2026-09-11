import { useEffect, useState } from "react";
import { ANCHORAN_VERSION } from "@/core/version";
import { AnchoranLogo } from "@/components/AnchoranLogo";
import { usePreferencesStore } from "@/theme/preferencesStore";

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

function StandardBoot({ onDone }: { onDone: () => void }) {
  const accentColor = usePreferencesStore((s) => s.accentColor);
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
      <AnchoranLogo
        size={84}
        color={accentColor}
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

  const label = phraseIndex === -1 ? `Finishing update to v${version}…` : FINISHING_PHRASES[phraseIndex];

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
      <AnchoranLogo size={72} color={accentColor} style={{ opacity: 0.95 }} />
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
