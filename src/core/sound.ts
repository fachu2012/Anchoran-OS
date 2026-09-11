import { usePreferencesStore } from "@/theme/preferencesStore";

/**
 * Anchoran's system sounds are synthesized in code via the Web Audio
 * API rather than shipped as audio files — short, quiet, deliberately
 * understated tones (a couple of sine partials with a soft envelope),
 * consistent with the "generable por código" approach used for icons
 * and wallpapers elsewhere in the project. No external asset needed.
 */

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

function playTone(freq: number, startOffset: number, duration: number, gain: number, ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;

  const start = ctx.currentTime + startOffset;
  gainNode.gain.setValueAtTime(0, start);
  gainNode.gain.linearRampToValueAtTime(gain, start + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playChord(notes: { freq: number; offset: number; duration: number; gain?: number }[]) {
  const { soundEnabled, soundVolume } = usePreferencesStore.getState();
  if (!soundEnabled || soundVolume <= 0) return;

  const ctx = getContext();
  if (!ctx) return;
  // Sounds can only start after a user gesture has unlocked the audio
  // context in most browsers/Electron builds; resume() is a no-op if
  // it's already running.
  ctx.resume().catch(() => {});
  for (const n of notes) playTone(n.freq, n.offset, n.duration, (n.gain ?? 0.05) * soundVolume, ctx);
}

/** Played once when the desktop finishes booting. */
export function playLoginSound() {
  playChord([
    { freq: 392.0, offset: 0, duration: 0.5, gain: 0.045 },
    { freq: 587.33, offset: 0.09, duration: 0.55, gain: 0.045 },
  ]);
}

/** Played for each new notification. */
export function playNotificationSound() {
  playChord([{ freq: 880, offset: 0, duration: 0.18, gain: 0.04 }]);
}

/** Played when Anchoran surfaces an unexpected error. */
export function playErrorSound() {
  playChord([
    { freq: 220, offset: 0, duration: 0.22, gain: 0.05 },
    { freq: 196, offset: 0.1, duration: 0.24, gain: 0.05 },
  ]);
}
